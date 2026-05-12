import { z } from 'zod';

export class GenerateBalanceBookDto {
  periodo: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  proyecto_id?: string;
  rut_emisor?: string;
  titulo?: string;
}

export const GenerateBalanceBookSchema = z.object({
  periodo: z
    .string()
    .min(4)
    .max(4)
    .regex(/^\d{4}$/, 'Debe ser un año de 4 dígitos'),
  fecha_inicio: z.string().datetime().optional(),
  fecha_fin: z.string().datetime().optional(),
  proyecto_id: z.string().min(1).optional(),
  rut_emisor: z.string().min(1).optional(),
  titulo: z.string().min(1).optional(),
});
