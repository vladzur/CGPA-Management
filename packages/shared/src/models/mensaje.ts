import { z } from 'zod';
import { TimestampSchema } from './utils';

/**
 * Motivos por los que un apoderado puede escribir a la directiva a través del
 * formulario de contacto del sitio institucional.
 */
export const MensajeMotivoSchema = z.enum([
  'CONSULTA_GENERAL',
  'CUOTAS_Y_PAGOS',
  'PROYECTOS_Y_ACTIVIDADES',
  'BENEFICIOS',
  'OTRO',
]);

/** Estado de atención de un mensaje dentro de la bandeja de la directiva. */
export const MensajeEstadoSchema = z.enum(['NUEVO', 'LEIDO', 'ARCHIVADO']);

export const MensajeSchema = z.object({
  nombre: z.string().trim().min(3, 'El nombre es obligatorio').max(120),
  email: z.string().trim().max(160).pipe(z.email('El correo no es válido')),
  telefono: z.string().trim().max(40).optional(),
  motivo: MensajeMotivoSchema,
  mensaje: z.string().trim().min(10, 'El mensaje es demasiado corto').max(2000),
  estado: MensajeEstadoSchema,
  fecha_creacion: TimestampSchema,
  actualizado_en: TimestampSchema.optional(),
  /** Integrante de la directiva que marcó el mensaje como atendido. */
  atendido_por: z
    .object({
      uid: z.string(),
      nombre: z.string(),
    })
    .optional(),
});

export type Mensaje = z.infer<typeof MensajeSchema>;
export type MensajeMotivo = z.infer<typeof MensajeMotivoSchema>;
export type MensajeEstado = z.infer<typeof MensajeEstadoSchema>;

/** Etiquetas en español de cada motivo, usadas por el formulario y la bandeja. */
export const MENSAJE_MOTIVO_LABELS: Record<MensajeMotivo, string> = {
  CONSULTA_GENERAL: 'Consulta general',
  CUOTAS_Y_PAGOS: 'Cuotas y pagos',
  PROYECTOS_Y_ACTIVIDADES: 'Proyectos y actividades',
  BENEFICIOS: 'Postulación a beneficios',
  OTRO: 'Otro',
};
