import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { EstadoPago, OperacionPasarela } from '@cgpa/shared';
import {
  ErrorPasarela,
  type CobroCreado,
  type PagoVerificado,
  type PasarelaPago,
  type SolicitudCobro,
} from '../pasarela-pago.interface';

/** Tiempo máximo de espera de una llamada a la API de Khipu. */
const KHIPU_TIMEOUT_MS = 10_000;

/** Respuesta de `POST /payments` de Khipu v3. */
interface KhipuPaymentCreated {
  payment_id?: string;
  payment_url?: string;
  simplified_transfer_url?: string;
  transfer_url?: string;
  app_url?: string;
  ready_for_terminal?: boolean;
}

/** Respuesta de `GET /payments/{id}` de Khipu v3. */
interface KhipuPaymentDetail {
  payment_id?: string;
  subject?: string;
  /** Khipu lo devuelve como cadena con decimales: `"1000.0000"`. */
  amount?: number | string;
  currency?: string;
  status?: string;
  status_detail?: string;
  payer_email?: string;
  transaction_id?: string;
  notification_token?: string;
  bank?: string;
  payer_name?: string;
  /** Fecha de conciliación bancaria (ISO-8601). */
  conciliation_date?: string;
  receipt_url?: string;
}

/**
 * Implementación de `PasarelaPago` para Khipu (API v3).
 *
 * Encapsula el payload, la autenticación con `x-api-key` y la traducción de los
 * estados de Khipu al vocabulario interno.
 */
@Injectable()
export class KhipuPasarela implements PasarelaPago {
  readonly id = 'khipu' as const;
  readonly nombre = 'Khipu';

  private readonly logger = new Logger(KhipuPasarela.name);

  async crearCobro(solicitud: SolicitudCobro): Promise<CobroCreado> {
    const apiKey = this.obtenerApiKey();

    const respuesta = await this.llamar<KhipuPaymentCreated>(
      '/payments',
      {
        method: 'POST',
        body: JSON.stringify({
          subject: solicitud.asunto,
          currency: 'CLP',
          amount: solicitud.monto,
          transaction_id: solicitud.transactionId,
          payer_email: solicitud.pagadorEmail,
          payer_name: solicitud.pagadorNombre,
          return_url: solicitud.urlRetorno,
          cancel_url: solicitud.urlCancelacion,
          notify_url: solicitud.urlNotificacion,
          // Los cobros creados con la API 3.0 solo admiten notificaciones 3.0,
          // que envían `payment_id` en el cuerpo del webhook.
          notify_api_version: '3.0',
          expires_date: solicitud.expiraEn,
        }),
      },
      apiKey,
      'CREAR_COBRO',
    );

    if (!respuesta?.payment_id || !respuesta?.payment_url) {
      this.logger.error(
        `Khipu no devolvió payment_id/payment_url para ${solicitud.transactionId}`,
      );
      throw new ErrorPasarela({
        proveedor: this.id,
        operacion: 'CREAR_COBRO',
        status: 200,
        codigo: 'RESPUESTA_INVALIDA',
        mensaje: 'Khipu no devolvió una URL de pago válida',
      });
    }

    return {
      referenciaExterna: respuesta.payment_id,
      urlPago: respuesta.payment_url,
    };
  }

  extraerReferenciaNotificacion(
    payload: Record<string, unknown>,
  ): string | null {
    // La API de notificaciones 3.0 envía `payment_id`; `notification_token`
    // queda como respaldo para notificaciones 1.3 de cobros antiguos.
    for (const campo of ['payment_id', 'notification_token']) {
      const valor = payload?.[campo];

      if (typeof valor === 'string' && valor.trim().length > 0) {
        return valor.trim();
      }
    }

    return null;
  }

  async verificarPago(referencia: string): Promise<PagoVerificado | null> {
    const apiKey = this.obtenerApiKey();
    const detalle = await this.llamar<KhipuPaymentDetail>(
      `/payments/${encodeURIComponent(referencia)}`,
      { method: 'GET' },
      apiKey,
      'VERIFICAR_PAGO',
    );

    const transactionId = detalle?.transaction_id?.trim();
    if (!transactionId) {
      this.logger.warn(
        'Khipu no informó transaction_id; se ignora para no acreditar un pago sin referencia local.',
      );
      return null;
    }

    const verificado: PagoVerificado = {
      transactionId,
      monto: Number(detalle.amount),
      moneda: (detalle.currency ?? 'CLP').toUpperCase(),
      estado: this.mapearEstado(detalle.status),
    };

    if (detalle.status_detail) verificado.estadoDetalle = detalle.status_detail;
    if (detalle.payment_id) verificado.referenciaExterna = detalle.payment_id;
    if (detalle.bank) verificado.banco = detalle.bank;

    const conciliadoEn = detalle.conciliation_date
      ? new Date(detalle.conciliation_date)
      : null;
    if (conciliadoEn && !Number.isNaN(conciliadoEn.getTime())) {
      verificado.pagadoEn = conciliadoEn;
    }

    return verificado;
  }

  // ─── Helpers internos ──────────────────────────────────────────────────────

  private obtenerApiKey(): string {
    const apiKey = process.env.KHIPU_API_KEY?.trim();

    if (!apiKey) {
      this.logger.error('KHIPU_API_KEY no está configurada');
      throw new ServiceUnavailableException(
        'La pasarela de pagos Khipu no está configurada',
      );
    }

    return apiKey;
  }

  private mapearEstado(status?: string): EstadoPago {
    switch ((status ?? '').toLowerCase()) {
      case 'done':
        return 'PAGADO';
      case 'cancelled':
        return 'CANCELADO';
      case 'failed':
        return 'FALLIDO';
      default:
        // `pending` y `verifying` siguen pendientes de confirmación bancaria.
        return 'PENDIENTE';
    }
  }

  private async llamar<T>(
    path: string,
    init: RequestInit,
    apiKey: string,
    operacion: OperacionPasarela,
  ): Promise<T> {
    const baseUrl = (
      process.env.KHIPU_API_BASE_URL ?? 'https://payment-api.khipu.com/v3'
    ).replace(/\/+$/, '');

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          ...init.headers,
        },
        signal: AbortSignal.timeout(KHIPU_TIMEOUT_MS),
      });

      if (!response.ok) {
        const detalle = await this.leerDetalleError(response);

        this.logger.error(
          `Khipu respondió HTTP ${response.status} en ${path}: ${detalle.mensaje}`,
        );
        throw new ErrorPasarela({
          proveedor: this.id,
          operacion,
          status: response.status,
          codigo: detalle.codigo,
          mensaje: detalle.mensaje,
        });
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ErrorPasarela) throw error;

      this.logger.error(
        `Error de comunicación con Khipu en ${path}: ${(error as Error).message}`,
      );
      throw new ErrorPasarela(
        {
          proveedor: this.id,
          operacion,
          status: null,
          codigo: 'NETWORK',
          mensaje: 'No se pudo comunicar con la pasarela de pagos',
        },
        error,
      );
    }
  }

  /**
   * Extrae un código y un mensaje seguros del cuerpo de error de Khipu.
   *
   * No se guarda el cuerpo crudo completo: solo los campos de error conocidos,
   * sin credenciales ni datos del pagador.
   */
  private async leerDetalleError(
    response: Response,
  ): Promise<{ codigo: string | null; mensaje: string }> {
    let texto = '';

    try {
      texto = (await response.text()).trim();
    } catch {
      texto = '';
    }

    let cuerpo: Record<string, unknown> | null = null;
    try {
      cuerpo = texto ? (JSON.parse(texto) as Record<string, unknown>) : null;
    } catch {
      cuerpo = null;
    }

    if (cuerpo) {
      const codigo =
        this.extraerTexto(cuerpo, ['code', 'error', 'error_code']) ??
        `HTTP_${response.status}`;
      const mensaje =
        this.extraerTexto(cuerpo, ['message', 'detail', 'error_description']) ??
        `Khipu respondió HTTP ${response.status}`;

      return {
        codigo: this.recortar(codigo, 100),
        mensaje: this.recortar(`${mensaje} (HTTP ${response.status})`, 500),
      };
    }

    // Si el cuerpo no es JSON no se guarda su contenido: podría incluir datos
    // que no corresponden a un mensaje de error controlado.
    return {
      codigo: `HTTP_${response.status}`,
      mensaje: `Khipu respondió HTTP ${response.status} sin detalle`,
    };
  }

  private extraerTexto(
    cuerpo: Record<string, unknown>,
    campos: string[],
  ): string | null {
    for (const campo of campos) {
      const valor = cuerpo[campo];

      if (typeof valor === 'string' && valor.trim().length > 0) {
        return valor.trim();
      }

      if (Array.isArray(valor)) {
        const textos = valor.filter(
          (item): item is string => typeof item === 'string',
        );

        if (textos.length > 0) return textos.join('; ');
      }
    }

    return null;
  }

  private recortar(texto: string, maximo: number): string {
    return texto.replace(/\s+/g, ' ').trim().slice(0, maximo);
  }
}
