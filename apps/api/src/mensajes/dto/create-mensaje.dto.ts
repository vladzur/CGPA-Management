import { z } from 'zod';
import { Mensaje, MensajeMotivoSchema } from '@cgpa/shared';

export class CreateMensajeDto implements Omit<
  Mensaje,
  'estado' | 'fecha_creacion' | 'actualizado_en' | 'atendido_por'
> {
  nombre: string;
  email: string;
  telefono?: string;
  motivo: Mensaje['motivo'];
  mensaje: string;
  /**
   * Campo trampa invisible para el usuario. Los envíos automatizados suelen
   * completarlo, así que su contenido delata una petición no humana.
   */
  sitio_web?: string;
}

export const CreateMensajeSchema = z.object({
  nombre: z.string().trim().min(3, 'El nombre es obligatorio').max(120),
  email: z.string().trim().max(160).pipe(z.email('El correo no es válido')),
  telefono: z.string().trim().max(40).optional(),
  motivo: MensajeMotivoSchema,
  mensaje: z.string().trim().min(10, 'El mensaje es demasiado corto').max(2000),
  sitio_web: z.string().max(200).optional(),
});
