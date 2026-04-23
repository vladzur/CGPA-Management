import { ProyectoSchema, Proyecto } from '@cgpa/shared';

export class CreateProyectoDto implements Omit<Proyecto, 'estado' | 'monto_recaudado' | 'monto_ejecutado' | 'fecha_inicio'> {
  nombre: string;
  descripcion: string;
  presupuesto_estimado: number;
  responsable: { uid: string; nombre: string; };
}

export const CreateProyectoSchema = ProyectoSchema.omit({
  monto_recaudado: true,
  monto_ejecutado: true,
  estado: true,
  fecha_inicio: true,
});
