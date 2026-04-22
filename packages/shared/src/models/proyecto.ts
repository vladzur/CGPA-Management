import { z } from 'zod';
import { TimestampSchema } from './utils';

export const EstadoProyectoSchema = z.enum(['PLANIFICACION', 'EN_CURSO', 'FINALIZADO']);

export const AvanceSchema = z.object({
  fecha: TimestampSchema,
  comentario: z.string().min(1),
  fotos: z.array(z.string().url('Debe ser una URL válida')),
  porcentaje_progreso: z.number().min(0).max(100),
});

export const ProyectoSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().min(1),
  estado: EstadoProyectoSchema,
  presupuesto_estimado: z.number().nonnegative(),
  monto_recaudado: z.number().nonnegative(),
  monto_ejecutado: z.number().nonnegative(),
  fecha_inicio: TimestampSchema,
  responsable: z.object({
    uid: z.string(),
    nombre: z.string(),
  }),
});

export type EstadoProyecto = z.infer<typeof EstadoProyectoSchema>;
export type Avance = z.infer<typeof AvanceSchema>;
export type Proyecto = z.infer<typeof ProyectoSchema>;
