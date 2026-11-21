import type { EstadoPago, ProveedorPago } from '@cgpa/shared';

/**
 * Token de inyección con la lista de pasarelas disponibles.
 *
 * El módulo de pagos inyecta todas las implementaciones registradas; el
 * orquestador elige una por su identificador sin conocer los detalles de cada
 * proveedor.
 */
export const PASARELAS_PAGO = Symbol('PASARELAS_PAGO');

/** Datos que el CGPA necesita de una pasarela para iniciar un cobro. */
export interface SolicitudCobro {
  /** Referencia interna única (se usa como orden de compra). */
  transactionId: string;
  asunto: string;
  /** Monto en pesos chilenos, sin decimales. */
  monto: number;
  pagadorEmail: string;
  pagadorNombre: string;
  /** URL del sitio a la que vuelve el apoderado tras pagar. */
  urlRetorno: string;
  /** URL del sitio a la que vuelve el apoderado si cancela. */
  urlCancelacion: string;
  /** Endpoint del backend que recibe la notificación del proveedor. */
  urlNotificacion: string;
  /** Fecha ISO de expiración del cobro. */
  expiraEn: string;
}

/** Resultado normalizado de crear un cobro en la pasarela. */
export interface CobroCreado {
  referenciaExterna: string;
  urlPago: string;
}

/**
 * Pago ya verificado contra la pasarela.
 *
 * Nunca se construye a partir del cuerpo de una notificación: cada pasarela
 * debe confirmarlo con una llamada autenticada de servidor a servidor.
 */
export interface PagoVerificado {
  transactionId: string;
  /** Monto informado por la pasarela, para contrastarlo con el cobro local. */
  monto: number;
  moneda: string;
  estado: EstadoPago;
  estadoDetalle?: string;
  referenciaExterna?: string;
  banco?: string;
  pagadoEn?: Date;
}

/**
 * Contrato que debe implementar cada método de pago.
 *
 * El orquestador (`PagosService`) se encarga de la persistencia, la
 * idempotencia y las transiciones de estado; la pasarela solo traduce su
 * protocolo a estas operaciones.
 */
export interface PasarelaPago {
  readonly id: ProveedorPago;
  readonly nombre: string;

  /** Crea el cobro en la pasarela y devuelve la URL del portal de pago. */
  crearCobro(solicitud: SolicitudCobro): Promise<CobroCreado>;

  /** Extrae la referencia a verificar del cuerpo de una notificación. */
  extraerReferenciaNotificacion(
    payload: Record<string, unknown>,
  ): string | null;

  /**
   * Verifica el pago contra la pasarela y normaliza el resultado.
   * Devuelve `null` cuando la notificación no identifica un pago válido.
   */
  verificarPago(referencia: string): Promise<PagoVerificado | null>;
}
