import { ComunicadoSchema, Comunicado } from '@cgpa/shared';
import { findMarkdownPolicyViolations } from '../../common/markdown/markdown-policy';

export class CreateComunicadoDto implements Omit<
  Comunicado,
  'fecha_creacion' | 'creado_por' | 'fecha_actualizacion'
> {
  titulo: string;
  contenido: string;
  estado: Comunicado['estado'];
  fecha_publicacion: Date;
}

const CreateComunicadoBaseSchema = ComunicadoSchema.omit({
  fecha_creacion: true,
  creado_por: true,
  fecha_actualizacion: true,
});

export const CreateComunicadoSchema = CreateComunicadoBaseSchema.superRefine(
  (value, ctx) => {
    for (const violation of findMarkdownPolicyViolations(value.contenido)) {
      ctx.addIssue({
        code: 'custom',
        path: ['contenido'],
        message: violation.message,
      });
    }
  },
);
