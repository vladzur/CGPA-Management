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
  respaldo_url: z.string().regex(/^https?:\/\/[^\s/$.?#]+\.[^\s]*$/, "URL inválida").optional(), // Puede ser opcional si aún no hay boleta/factura
  registrado_por: z.object({
    uid: z.string(),
    nombre: z.string(),
  }),
  estado: EstadoTransaccionSchema,
  proyecto_id: z.string().optional(), // Referencia a la colección proyectos

  // ─── Campos de integridad criptográfica (Append-Only Chain) ─────────────────
  /**
   * Número ordinal de la transacción en la cadena (1, 2, 3...).
   * Permite reconstruir el orden histórico sin depender de timestamps.
   */
  numero_secuencia: z.number().int().min(0).optional(),

  /**
   * Hash SHA-256 de la transacción anterior en la cadena.
   * Es null para la primera transacción del sistema.
   * Al encadenar hashes, cualquier alteración de un registro pasado
   * invalida todos los hashes subsiguientes.
   */
  hash_previo: z.string().nullable().optional(),

  /**
   * Hash SHA-256 determinístico de los campos críticos de ESTA transacción
   * más el hash_previo y el numero_secuencia.
   * Sirve como sello criptográfico de inmutabilidad.
   */
  hash_integridad: z.string().optional(),
});

export type TipoTransaccion = z.infer<typeof TipoTransaccionSchema>;
export type EstadoTransaccion = z.infer<typeof EstadoTransaccionSchema>;
export type Transaccion = z.infer<typeof TransaccionSchema>;
