import { z } from 'zod';
import { TimestampSchema } from './utils';

export const EstadoComunicadoSchema = z.enum(['BORRADOR', 'PUBLICADO']);

export const ComunicadoSchema = z.object({
  titulo: z.string().min(1, 'El titulo es requerido'),
  contenido: z.string().min(1, 'El contenido es requerido'),
  estado: EstadoComunicadoSchema,
  fecha_publicacion: TimestampSchema,
  fecha_creacion: TimestampSchema,
  creado_por: z.object({
    uid: z.string(),
    nombre: z.string(),
  }),
  fecha_actualizacion: TimestampSchema.optional(),
});

export type EstadoComunicado = z.infer<typeof EstadoComunicadoSchema>;
export type Comunicado = z.infer<typeof ComunicadoSchema>;
