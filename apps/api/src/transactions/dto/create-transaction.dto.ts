import { TransaccionSchema, Transaccion } from '@cgpa/shared';

/**
 * DTO para la creación de transacciones en la API.
 * Omite los campos que el backend inyectará internamente (como el usuario que registra y el estado inicial).
 */
export class CreateTransactionDto implements Omit<Transaccion, 'estado' | 'registrado_por'> {
  tipo: Transaccion['tipo'];
  monto: number;
  fecha: Date; // A nivel de backend usamos Date de JS
  categoria: string;
  descripcion: string;
  respaldo_url?: string;
  proyecto_id?: string;
}

/**
 * Esquema Zod derivado para validación en NestJS Pipes
 */
export const CreateTransactionSchema = TransaccionSchema.omit({
  registrado_por: true,
  estado: true,
});
