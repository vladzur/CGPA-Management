import { z } from 'zod';

export class UpdateProyectoDto {
  presupuesto_estimado?: number;
  nombre?: string;
  descripcion?: string;
}

export const UpdateProyectoSchema = z.object({
  presupuesto_estimado: z.number().nonnegative().optional(),
  nombre: z.string().min(1).optional(),
  descripcion: z.string().min(1).optional(),
});
