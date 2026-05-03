import { ComunicadoSchema, Comunicado } from '@cgpa/shared';

export class CreateComunicadoDto implements Omit<Comunicado, 'fecha_creacion' | 'creado_por' | 'fecha_actualizacion'> {
  titulo: string;
  contenido: string;
  estado: Comunicado['estado'];
  fecha_publicacion: Date;
}

export const CreateComunicadoSchema = ComunicadoSchema.omit({
  fecha_creacion: true,
  creado_por: true,
  fecha_actualizacion: true,
});
