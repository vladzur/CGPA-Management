import { z } from 'zod';
import { TimestampSchema } from './utils';

export const InstitucionSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  periodo_actual: z.string().min(4), // Ej: "2026"
  saldo_total: z.number(),
  ultima_actualizacion: TimestampSchema,
});

export type Institucion = z.infer<typeof InstitucionSchema>;
