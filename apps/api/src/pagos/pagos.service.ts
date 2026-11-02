import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as admin from 'firebase-admin';
import { type EstadoPago, type Pago, type ProveedorPago } from '@cgpa/shared';
import { CreatePagoDto } from './dto/create-pago.dto';
import { PasarelasService } from './pasarelas/pasarelas.service';
import type { PagoVerificado } from './pasarelas/pasarela-pago.interface';
import { firestoreNow } from '../common/firestore-utils';

/** Días de vigencia de un cobro, configurables por entorno. */
const PAGO_TTL_DIAS_DEFAULT = 7;

/** Colección por defecto donde se persisten los cobros. */
const COLECCION_PAGOS_DEFAULT = 'pagos';

/**
 * Nombres válidos de colección. Evita configurar rutas con `/`, que Firestore
 * interpretaría como subcolecciones.
 */
const PATRON_COLECCION = /^[A-Za-z0-9_-]{1,100}$/;

/** Resultado de procesar una notificación, útil para tests y logs. */
export interface ResultadoNotificacion {
  actualizado: boolean;
  estado: EstadoPago | null;
  /**
   * Cobro identificado por la pasarela, si lo hubo. Permite que un controlador
   * de retorno propio (por ejemplo uno que debe redirigir al sitio) sepa a qué
   * transacción volver sin confiar en el cuerpo de la petición.
   */
  transactionId: string | null;
}

/** Datos públicos de un cobro, sin tokens ni datos personales. */
export type PagoPublico = Pick<
  Pago,
  | 'transaction_id'
  | 'proveedor'
  | 'asunto'
  | 'moneda'
  | 'monto'
  | 'estado'
  | 'estado_detalle'
  | 'banco'
  | 'pagado_en'
  | 'creado_en'
  | 'actualizado_en'
>;

/** Respuesta pública al iniciar un cobro. */
export interface CobroIniciado {
  transaction_id: string;
  proveedor: ProveedorPago;
  payment_url: string;
  referencia_externa: string;
}

/**
 * Orquesta los cobros sin depender de la pasarela concreta.
 *
 * Aquí viven la persistencia, la idempotencia y las transiciones de estado; los
 * detalles de cada proveedor quedan detrás de `PasarelaPago`.
 */
@Injectable()
export class PagosService {
  private readonly logger = new Logger(PagosService.name);

  constructor(private readonly pasarelas: PasarelasService) {}

  private get db() {
    return admin.firestore();
  }

  /**
   * Colección efectiva de cobros.
   *
   * `PAGOS_COLECCION` permite apuntar una prueba funcional a una colección
   * aparte (por ejemplo `pagos_sandbox`) sin contaminar el historial real.
   */
  private get coleccionPagos(): string {
    const configurada = process.env.PAGOS_COLECCION?.trim();

    if (!configurada) return COLECCION_PAGOS_DEFAULT;

    if (!PATRON_COLECCION.test(configurada)) {
      this.logger.warn(
        `PAGOS_COLECCION inválida (${configurada}); se usa ${COLECCION_PAGOS_DEFAULT}`,
      );
      return COLECCION_PAGOS_DEFAULT;
    }

    return configurada;
  }

  /**
   * Crea un cobro en la pasarela indicada y persiste el registro local en
   * estado `PENDIENTE`.
   *
   * El `transaction_id` y las URLs de retorno se generan aquí para que un
   * cliente no pueda alterar el destinatario, el monto ni el flujo de retorno.
   */
  async crearPago(
    proveedorId: string,
    dto: CreatePagoDto,
  ): Promise<CobroIniciado> {
    const pasarela = this.pasarelas.obtener(proveedorId);
    const transactionId = this.generarTransactionId();
    const asunto = `CGPA - ${dto.concepto}`;
    const clientBaseUrl = this.obtenerClientBaseUrl();

    const cobro = await pasarela.crearCobro({
      transactionId,
      asunto,
      monto: dto.monto,
      pagadorEmail: dto.pagador_email,
      pagadorNombre: dto.pagador_nombre,
      urlRetorno: this.conParametro(
        `${clientBaseUrl}/pagar/confirmacion`,
        transactionId,
      ),
      urlCancelacion: this.conParametro(
        `${clientBaseUrl}/pagar/cancelado`,
        transactionId,
      ),
      urlNotificacion: this.obtenerUrlNotificacion(pasarela.id),
      expiraEn: this.fechaExpiracion(),
    });

    const ahora = firestoreNow();
    const pago: Pago = {
      transaction_id: transactionId,
      proveedor: pasarela.id,
      referencia_externa: cobro.referenciaExterna,
      asunto,
      moneda: 'CLP',
      monto: dto.monto,
      pagador_email: dto.pagador_email,
      pagador_nombre: dto.pagador_nombre,
      estado: 'PENDIENTE',
      url_pago: cobro.urlPago,
      creado_en: ahora,
      actualizado_en: ahora,
    };

    await this.db.collection(this.coleccionPagos).doc(transactionId).set(pago);

    this.logger.log(
      `Cobro ${pasarela.id} creado transaction_id=${transactionId} referencia=${cobro.referenciaExterna}`,
    );

    return {
      transaction_id: transactionId,
      proveedor: pasarela.id,
      payment_url: cobro.urlPago,
      referencia_externa: cobro.referenciaExterna,
    };
  }

  /**
   * Valida una notificación de la pasarela consultando el pago servidor a
   * servidor. Nunca se confía en el cuerpo recibido: el estado se toma de la
   * respuesta autenticada del proveedor y la actualización es idempotente.
   */
  async procesarNotificacion(
    proveedorId: string,
    payload: Record<string, unknown>,
  ): Promise<ResultadoNotificacion> {
    const pasarela = this.pasarelas.obtener(proveedorId);
    const referencia = pasarela.extraerReferenciaNotificacion(payload);

    if (!referencia) {
      this.logger.warn(
        `Notificación de ${pasarela.id} sin referencia de pago; se ignora.`,
      );
      return { actualizado: false, estado: null, transactionId: null };
    }

    const verificado = await pasarela.verificarPago(referencia);

    if (!verificado) {
      return { actualizado: false, estado: null, transactionId: null };
    }

    return this.aplicarVerificacion(pasarela.id, verificado, referencia);
  }

  /**
   * Devuelve el estado de un cobro. Si sigue pendiente y ya existe un token de
   * notificación, reconcilia contra la pasarela para no depender de que el
   * webhook haya llegado antes que el apoderado vuelva al sitio.
   */
  async consultarPago(transactionId: string): Promise<PagoPublico> {
    const pagoRef = this.db.collection(this.coleccionPagos).doc(transactionId);
    let snapshot = await pagoRef.get();

    if (!snapshot.exists) {
      throw new NotFoundException('El pago solicitado no existe');
    }

    let pago = snapshot.data() as Pago;

    if (pago.estado === 'PENDIENTE' && pago.token_notificacion) {
      try {
        const pasarela = this.pasarelas.obtener(pago.proveedor);
        const verificado = await pasarela.verificarPago(
          pago.token_notificacion,
        );

        if (verificado) {
          await this.aplicarVerificacion(
            pago.proveedor,
            verificado,
            pago.token_notificacion,
          );
          snapshot = await pagoRef.get();
          pago = snapshot.data() as Pago;
        }
      } catch (error) {
        this.logger.warn(
          `No se pudo reconciliar el pago ${transactionId}: ${(error as Error).message}`,
        );
      }
    }

    return this.aPagoPublico(pago);
  }

  /** Lista los últimos cobros para la directiva, sin exponer sus tokens. */
  async listarPagos(): Promise<Array<Pago & { id: string }>> {
    const snapshot = await this.db
      .collection(this.coleccionPagos)
      .orderBy('creado_en', 'desc')
      .limit(200)
      .get();

    return snapshot.docs.map((doc) => {
      const data = { ...(doc.data() as Pago) };
      delete (data as Partial<Pago>).token_notificacion;
      return { id: doc.id, ...data };
    });
  }

  // ─── Estado e idempotencia ─────────────────────────────────────────────────

  /**
   * Aplica un pago verificado al registro local.
   *
   * Se ejecuta dentro de una transacción de Firestore y descarta notificaciones
   * duplicadas, de otro proveedor o con montos que no coinciden.
   */
  private async aplicarVerificacion(
    proveedorId: ProveedorPago,
    verificado: PagoVerificado,
    tokenNotificacion?: string,
  ): Promise<ResultadoNotificacion> {
    const pagoRef = this.db
      .collection(this.coleccionPagos)
      .doc(verificado.transactionId);

    return this.db.runTransaction<ResultadoNotificacion>(async (t) => {
      const snapshot = await t.get(pagoRef);

      if (!snapshot.exists) {
        this.logger.warn(
          `Notificación para un cobro desconocido: ${verificado.transactionId}`,
        );
        return {
          actualizado: false,
          estado: null,
          transactionId: verificado.transactionId,
        };
      }

      const actual = snapshot.data() as Pago;

      // La notificación debe venir por el mismo método con el que se creó el
      // cobro; si no, no se aplica ningún cambio.
      const proveedorActual: string = actual.proveedor;
      if (proveedorActual !== proveedorId) {
        this.logger.error(
          `Notificación de ${proveedorId} para un cobro de ${proveedorActual}: ${verificado.transactionId}`,
        );
        return {
          actualizado: false,
          estado: actual.estado,
          transactionId: verificado.transactionId,
        };
      }

      // El monto y la moneda informados deben coincidir con el cobro original.
      if (
        verificado.monto !== actual.monto ||
        verificado.moneda !== actual.moneda
      ) {
        this.logger.error(
          `Discrepancia en el pago ${verificado.transactionId}: notificado=${verificado.monto} ${verificado.moneda}, registrado=${actual.monto} ${actual.moneda}`,
        );
        return {
          actualizado: false,
          estado: actual.estado,
          transactionId: verificado.transactionId,
        };
      }

      if (!this.debeActualizar(actual.estado, verificado.estado)) {
        return {
          actualizado: false,
          estado: actual.estado,
          transactionId: verificado.transactionId,
        };
      }

      const cambios: Record<string, unknown> = {
        estado: verificado.estado,
        token_notificacion:
          tokenNotificacion ?? actual.token_notificacion ?? null,
        estado_detalle: verificado.estadoDetalle ?? null,
        pagado_en:
          verificado.estado === 'PAGADO'
            ? (actual.pagado_en ?? verificado.pagadoEn ?? firestoreNow())
            : (actual.pagado_en ?? null),
        actualizado_en: firestoreNow(),
      };

      if (verificado.referenciaExterna) {
        cambios.referencia_externa = verificado.referenciaExterna;
      }
      if (verificado.banco) {
        cambios.banco = verificado.banco;
      }

      t.update(pagoRef, cambios);

      this.logger.log(
        `Cobro ${verificado.transactionId} actualizado: ${actual.estado} → ${verificado.estado}`,
      );

      return {
        actualizado: true,
        estado: verificado.estado,
        transactionId: verificado.transactionId,
      };
    });
  }

  /**
   * Evita retrocesos: un pago confirmado nunca vuelve a pendiente por una
   * notificación duplicada o fuera de orden.
   */
  private debeActualizar(actual: EstadoPago, notificado: EstadoPago): boolean {
    if (actual === 'PAGADO') return false;
    if (notificado === 'PENDIENTE') return actual === 'PENDIENTE';

    return actual !== notificado;
  }

  // ─── Helpers internos ──────────────────────────────────────────────────────

  private obtenerClientBaseUrl(): string {
    const baseUrl =
      process.env.CLIENT_BASE_URL ??
      process.env.VERIFICATION_BASE_URL ??
      'http://localhost:5173';

    return baseUrl.replace(/\/+$/, '');
  }

  private obtenerUrlNotificacion(proveedorId: ProveedorPago): string {
    const publicApiUrl = process.env.PUBLIC_API_URL?.trim();

    if (publicApiUrl) {
      return `${publicApiUrl.replace(/\/+$/, '')}/pagos/${proveedorId}/webhook`;
    }

    // En producción el sitio publica la API bajo /api mediante el rewrite de
    // Firebase Hosting, así que la URL de verificación se deriva del sitio.
    const siteBaseUrl = process.env.VERIFICATION_BASE_URL?.trim();
    if (siteBaseUrl) {
      return `${siteBaseUrl.replace(/\/+$/, '')}/api/pagos/${proveedorId}/webhook`;
    }

    return `http://localhost:3000/api/pagos/${proveedorId}/webhook`;
  }

  private generarTransactionId(): string {
    const year = new Date().getFullYear();
    const sufijo = randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();

    return `CGPA-PAY-${year}-${sufijo}`;
  }

  private conParametro(base: string, transactionId: string): string {
    const url = new URL(base);
    url.searchParams.set('transaction_id', transactionId);

    return url.toString();
  }

  private fechaExpiracion(): string {
    const dias = Number(process.env.PAGO_TTL_DIAS);
    const ttlDias =
      Number.isFinite(dias) && dias > 0 ? dias : PAGO_TTL_DIAS_DEFAULT;
    const expiracion = new Date(Date.now() + ttlDias * 24 * 60 * 60 * 1000);

    // Las pasarelas documentan el formato ISO sin milisegundos.
    return expiracion.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private aPagoPublico(pago: Pago): PagoPublico {
    return {
      transaction_id: pago.transaction_id,
      proveedor: pago.proveedor,
      asunto: pago.asunto,
      moneda: pago.moneda,
      monto: pago.monto,
      estado: pago.estado,
      estado_detalle: pago.estado_detalle,
      banco: pago.banco,
      pagado_en: pago.pagado_en,
      creado_en: pago.creado_en,
      actualizado_en: pago.actualizado_en,
    };
  }
}
