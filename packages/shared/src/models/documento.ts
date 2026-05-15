import { z } from 'zod';
import { TimestampSchema } from './utils';

export const EstadoDocumentoSchema = z.enum(['BORRADOR', 'SELLADO']);

export const DocumentoSchema = z.object({
  titulo: z.string().min(1, 'El titulo es requerido'),
  descripcion: z.string().min(1, 'La descripcion es requerida'),
  monto: z.number().positive('El monto debe ser positivo'),
  fecha_emision: TimestampSchema,
  rut_emisor: z.string().min(1, 'El RUT del emisor es requerido'),
  estado: EstadoDocumentoSchema,
  creado_por: z.object({
    uid: z.string(),
    nombre: z.string(),
  }),
  fecha_creacion: TimestampSchema,
  fecha_actualizacion: TimestampSchema.optional(),
  hash_integridad: z.string().optional(),
  uuid_verificacion: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "UUID inválido").optional(),
  qr_base64: z.string().optional(),
  salt: z.string().optional(),
  fecha_sellado: TimestampSchema.optional(),
});

export type EstadoDocumento = z.infer<typeof EstadoDocumentoSchema>;
export type Documento = z.infer<typeof DocumentoSchema>;
