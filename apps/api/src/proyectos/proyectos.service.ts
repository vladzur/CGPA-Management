import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { Proyecto } from '@cgpa/shared';

@Injectable()
export class ProyectosService {
  private get db() {
    return admin.firestore();
  }

  async create(createProyectoDto: CreateProyectoDto) {
    const proyectoRef = this.db.collection('proyectos').doc();
    
    const nuevoProyecto: Proyecto = {
      ...createProyectoDto,
      estado: 'PLANIFICACION',
      monto_recaudado: 0,
      monto_ejecutado: 0,
      fecha_inicio: admin.firestore.Timestamp.now() as any,
    };

    await proyectoRef.set(nuevoProyecto);
    return { id: proyectoRef.id, ...nuevoProyecto };
  }

  async findAll() {
    const snapshot = await this.db.collection('proyectos').get();
    return snapshot.docs.map(doc => {
      const data = doc.data() as Proyecto;
      // Resumen financiero: presupuesto vs ejecutado
      const avance_financiero = data.presupuesto_estimado > 0 
        ? Math.min((data.monto_ejecutado / data.presupuesto_estimado) * 100, 100) 
        : 0;

      return {
        id: doc.id,
        ...data,
        avance_financiero,
      };
    });
  }

  async findOne(id: string) {
    const doc = await this.db.collection('proyectos').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }
    const data = doc.data() as Proyecto;
    const avance_financiero = data.presupuesto_estimado > 0 
      ? Math.min((data.monto_ejecutado / data.presupuesto_estimado) * 100, 100) 
      : 0;

    return { id: doc.id, ...data, avance_financiero };
  }

  async update(id: string, updateProyectoDto: UpdateProyectoDto) {
    const docRef = this.db.collection('proyectos').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    const data = doc.data() as Proyecto;
    let updates: any = { ...updateProyectoDto };

    // Si el presupuesto cambia, recalcular porcentaje de avance
    if (updateProyectoDto.presupuesto_estimado !== undefined) {
      const nuevoPresupuesto = updateProyectoDto.presupuesto_estimado;
      const avance_financiero = nuevoPresupuesto > 0 
        ? Math.min((data.monto_ejecutado / nuevoPresupuesto) * 100, 100) 
        : 0;
      
      // Guardamos el avance en la bd por si se consulta desde otro lado
      updates.avance_financiero = avance_financiero;
    }

    await docRef.update(updates);
    return { id, ...updates };
  }

  async remove(id: string) {
    // Solo permitir si no tiene transacciones asociadas (integridad referencial)
    const transaccionesSnapshot = await this.db.collection('transacciones')
      .where('proyecto_id', '==', id)
      .limit(1)
      .get();
      
    if (!transaccionesSnapshot.empty) {
      throw new BadRequestException('No se puede eliminar el proyecto porque tiene transacciones asociadas.');
    }
    
    await this.db.collection('proyectos').doc(id).delete();
    return { message: 'Proyecto eliminado correctamente' };
  }
}
