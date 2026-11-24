import { z } from 'zod';
import {
  EstadoComunicadoSchema,
  EstadoComunicado,
  TimestampSchema,
} from '@cgpa/shared';
import { findMarkdownPolicyViolations } from '../../common/markdown/markdown-policy';

export class UpdateComunicadoDto {
  titulo?: string;
  contenido?: string;
  estado?: EstadoComunicado;
  fecha_publicacion?: Date;
}

export const UpdateComunicadoSchema = z
  .object({
    titulo: z.string().min(1).optional(),
    contenido: z.string().min(1).optional(),
    estado: EstadoComunicadoSchema.optional(),
    fecha_publicacion: TimestampSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.contenido === undefined) return;

    for (const violation of findMarkdownPolicyViolations(value.contenido)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contenido'],
        message: violation.message,
      });
    }
  });
