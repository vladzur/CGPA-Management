import { z } from 'zod';
import { PAGO_MONTO_MAXIMO, PAGO_MONTO_MINIMO } from '@cgpa/shared';

/**
 * Datos que el apoderado completa en el botón de pago.
 *
 * El `transaction_id`, las URLs de retorno y la clave de API los genera el
 * backend: nunca se aceptan desde el cliente.
 */
export class CreatePagoDto {
  /** Descripción del cobro que verá el apoderado en Khipu. */
  concepto: string;
  /** Monto en pesos chilenos, sin decimales. */
  monto: number;
  pagador_email: string;
  pagador_nombre: string;
}

export const CreatePagoSchema = z.object({
  concepto: z
    .string()
    .trim()
    .min(3, 'El concepto es obligatorio')
    .max(200, 'El concepto es demasiado largo'),
  monto: z.coerce
    .number()
    .int('El monto debe ser un entero en pesos')
    .min(PAGO_MONTO_MINIMO, 'El monto es demasiado bajo')
    .max(PAGO_MONTO_MAXIMO, 'El monto supera el máximo permitido'),
  pagador_email: z
    .string()
    .trim()
    .max(160)
    .pipe(z.email('El correo del apoderado no es válido')),
  pagador_nombre: z
    .string()
    .trim()
    .min(3, 'El nombre del apoderado es obligatorio')
    .max(120, 'El nombre del apoderado es demasiado largo'),
});
