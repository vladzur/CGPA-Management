import { z } from 'zod';
import { EstadoComunicadoSchema, EstadoComunicado, TimestampSchema } from '@cgpa/shared';

export class UpdateComunicadoDto {
  titulo?: string;
  contenido?: string;
  estado?: EstadoComunicado;
  fecha_publicacion?: Date;
}

export const UpdateComunicadoSchema = z.object({
  titulo: z.string().min(1).optional(),
  contenido: z.string().min(1).optional(),
  estado: EstadoComunicadoSchema.optional(),
  fecha_publicacion: TimestampSchema.optional(),
});
