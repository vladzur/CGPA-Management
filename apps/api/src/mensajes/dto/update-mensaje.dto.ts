import { z } from 'zod';
import { MensajeEstado, MensajeEstadoSchema } from '@cgpa/shared';

export class UpdateMensajeDto {
  estado?: MensajeEstado;
}

export const UpdateMensajeSchema = z.object({
  estado: MensajeEstadoSchema,
});
