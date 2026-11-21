import { z } from 'zod';
import { TimestampSchema } from './utils';

/**
 * Pasarelas de pago soportadas por la plataforma.
 *
 * Agregar una pasarela nueva requiere sumar su identificador aquí, implementar
 * `PasarelaPago` en el backend y registrarla en el módulo de pagos.
 */
export const ProveedorPagoSchema = z.enum(['khipu']);

/**
 * Estado interno de un cobro.
 *
 * Cada pasarela traduce sus propios estados a este vocabulario antes de
 * persistirlos, de modo que la contabilidad y la UI no dependan del proveedor.
 */
export const EstadoPagoSchema = z.enum([
  'PENDIENTE',
  'PAGADO',
  'CANCELADO',
  'FALLIDO',
]);

/**
 * Tipos de aporte que ofrece el sitio público.
 *
 * La cuota anual y la donación voluntaria comparten el mismo flujo de cobro;
 * el tipo solo cambia el asunto y los campos que se guardan para conciliar.
 */
export const TipoAporteSchema = z.enum(['CUOTA_ANUAL', 'DONACION']);

/**
 * Registro persistido en la colección `pagos`.
 *
 * `transaction_id` es el identificador interno del CGPA y se usa también como
 * id del documento, de modo que cada cobro sea único e idempotente.
 */
export const PagoSchema = z.object({
  transaction_id: z.string().min(1),
  proveedor: ProveedorPagoSchema,
  /** Identificador del cobro asignado por la pasarela. */
  referencia_externa: z.string().optional(),
  /** Token con el que la pasarela notifica o permite verificar el pago. */
  token_notificacion: z.string().optional(),
  asunto: z.string().min(1),
  moneda: z.literal('CLP'),
  monto: z.number().int().positive(),
  pagador_email: z.string(),
  pagador_nombre: z.string(),
  /** Tipo de aporte elegido por el pagador. */
  tipo_aporte: TipoAporteSchema.optional(),
  /** Período de la cuota anual (por ejemplo 2027). */
  periodo: z.number().int().positive().optional(),
  /** Estudiante o curso informado por el apoderado en la cuota anual. */
  estudiante: z.string().optional(),
  estado: EstadoPagoSchema,
  estado_detalle: z.string().optional(),
  banco: z.string().optional(),
  /** URL del portal de pago a la que se redirige al apoderado. */
  url_pago: z.string().optional(),
  pagado_en: TimestampSchema.nullable().optional(),
  creado_en: TimestampSchema,
  actualizado_en: TimestampSchema,
});

export type ProveedorPago = z.infer<typeof ProveedorPagoSchema>;
export type EstadoPago = z.infer<typeof EstadoPagoSchema>;
export type TipoAporte = z.infer<typeof TipoAporteSchema>;
export type Pago = z.infer<typeof PagoSchema>;

/** Etiquetas en español de cada estado, usadas por la página de resultado. */
export const ESTADO_PAGO_LABELS: Record<EstadoPago, string> = {
  PENDIENTE: 'Pendiente de confirmación',
  PAGADO: 'Pago confirmado',
  CANCELADO: 'Pago cancelado',
  FALLIDO: 'Pago fallido',
};

/** Nombre visible de cada pasarela, usado por el selector de método de pago. */
export const PROVEEDOR_PAGO_LABELS: Record<ProveedorPago, string> = {
  khipu: 'Khipu',
};

/** Pasarela que ofrece el formulario público mientras exista una sola. */
export const PROVEEDOR_PAGO_PREDETERMINADO: ProveedorPago = 'khipu';

/** Etiquetas en español de cada tipo de aporte. */
export const TIPO_APORTE_LABELS: Record<TipoAporte, string> = {
  CUOTA_ANUAL: 'Cuota anual',
  DONACION: 'Donación voluntaria',
};

/** Montos admitidos por el botón de pago, en pesos chilenos enteros. */
export const PAGO_MONTO_MINIMO = 100;
export const PAGO_MONTO_MAXIMO = 10_000_000;

/**
 * Período y monto sugerido de la cuota anual vigente.
 *
 * El monto es solo una sugerencia: el apoderado puede ajustarlo (por ejemplo,
 * para pagar la cuota de más de un estudiante). Actualizar cada año.
 */
export const CUOTA_ANUAL_PERIODO = 2027;
export const CUOTA_ANUAL_MONTO_SUGERIDO = 10_000;

/** Monto sugerido para una donación voluntaria. */
export const DONACION_MONTO_SUGERIDO = 10_000;
