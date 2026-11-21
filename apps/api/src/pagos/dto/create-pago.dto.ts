import { z } from 'zod';
import {
  PAGO_MONTO_MAXIMO,
  PAGO_MONTO_MINIMO,
  TipoAporteSchema,
  type TipoAporte,
} from '@cgpa/shared';

/**
 * Datos que el pagador completa en el botón de pago.
 *
 * El `transaction_id`, el asunto, las URLs de retorno y la clave de API los
 * genera el backend: nunca se aceptan desde el cliente.
 */
export class CreatePagoDto {
  /** Cuota anual o donación voluntaria. */
  tipo_aporte: TipoAporte;
  /** Monto en pesos chilenos, sin decimales. */
  monto: number;
  pagador_email: string;
  pagador_nombre: string;
  /** Estudiante o curso, solo aplica a la cuota anual. */
  estudiante?: string;
}

export const CreatePagoSchema = z
  .object({
    tipo_aporte: TipoAporteSchema,
    monto: z.coerce
      .number()
      .int('El monto debe ser un entero en pesos')
      .min(PAGO_MONTO_MINIMO, 'El monto es demasiado bajo')
      .max(PAGO_MONTO_MAXIMO, 'El monto supera el máximo permitido'),
    pagador_email: z
      .string()
      .trim()
      .max(160)
      .pipe(z.email('El correo del pagador no es válido')),
    pagador_nombre: z
      .string()
      .trim()
      .min(3, 'El nombre del pagador es obligatorio')
      .max(120, 'El nombre del pagador es demasiado largo'),
    estudiante: z
      .string()
      .trim()
      .max(120, 'El estudiante o curso es demasiado largo')
      .optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.tipo_aporte !== 'CUOTA_ANUAL' && datos.estudiante) {
      ctx.addIssue({
        code: 'custom',
        path: ['estudiante'],
        message: 'El estudiante solo aplica a la cuota anual',
      });
    }
  });
