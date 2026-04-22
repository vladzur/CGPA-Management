import { z } from 'zod';
import { TimestampSchema } from './utils';

export const TipoTransaccionSchema = z.enum(['INGRESO', 'EGRESO']);
export const EstadoTransaccionSchema = z.enum(['CONCILIADO', 'PENDIENTE']);

export const TransaccionSchema = z.object({
  tipo: TipoTransaccionSchema,
  monto: z.coerce.number().positive('El monto debe ser mayor a 0'),
  fecha: TimestampSchema,
  categoria: z.string().min(1),
  descripcion: z.string().min(1),
  respaldo_url: z.string().url().optional(), // Puede ser opcional si aún no hay boleta/factura
  registrado_por: z.object({
    uid: z.string(),
    nombre: z.string(),
  }),
  estado: EstadoTransaccionSchema,
  proyecto_id: z.string().optional(), // Referencia a la colección proyectos
});

export type TipoTransaccion = z.infer<typeof TipoTransaccionSchema>;
export type EstadoTransaccion = z.infer<typeof EstadoTransaccionSchema>;
export type Transaccion = z.infer<typeof TransaccionSchema>;
