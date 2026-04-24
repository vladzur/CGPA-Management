import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { Proyecto } from '@cgpa/shared';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class ProyectosService {
  constructor(private readonly auditService: AuditService) {}

  private get db() {
    return admin.firestore();
  }

  async create(createProyectoDto: CreateProyectoDto, userUid: string, userName: string) {
    const proyectoRef = this.db.collection('proyectos').doc();
    
    const nuevoProyecto: Proyecto = {
      ...createProyectoDto,
      estado: 'PLANIFICACION',
      monto_recaudado: 0,
      monto_ejecutado: 0,
      fecha_inicio: admin.firestore.Timestamp.now() as any,
    };

    const batch = this.db.batch();
    batch.set(proyectoRef, nuevoProyecto);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: userUid,
      nombre_usuario: userName,
      accion: 'CREAR_PROYECTO',
      coleccion: 'proyectos',
      documento_id: proyectoRef.id,
      payload_nuevo: nuevoProyecto,
    });

    await batch.commit();
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

  async update(id: string, updateProyectoDto: UpdateProyectoDto, userUid: string, userName: string) {
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

    const batch = this.db.batch();
    batch.update(docRef, updates);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: userUid,
      nombre_usuario: userName,
      accion: 'ACTUALIZAR_PROYECTO',
      coleccion: 'proyectos',
      documento_id: id,
      payload_anterior: data,
      payload_nuevo: updates,
    });

    await batch.commit();
    return { id, ...updates };
  }

  async remove(id: string, userUid: string, userName: string) {
    // Solo permitir si no tiene transacciones asociadas (integridad referencial)
    const transaccionesSnapshot = await this.db.collection('transacciones')
      .where('proyecto_id', '==', id)
      .limit(1)
      .get();
      
    if (!transaccionesSnapshot.empty) {
      throw new BadRequestException('No se puede eliminar el proyecto porque tiene transacciones asociadas.');
    }
    
    const docRef = this.db.collection('proyectos').doc(id);
    const doc = await docRef.get();
    const data = doc.exists ? doc.data() : null;

    const batch = this.db.batch();
    batch.delete(docRef);

    if (data) {
      this.auditService.logActionWithTransactionOrBatch(batch, {
        usuario_id: userUid,
        nombre_usuario: userName,
        accion: 'ELIMINAR_PROYECTO',
        coleccion: 'proyectos',
        documento_id: id,
        payload_anterior: data,
      });
    }

    await batch.commit();
    return { message: 'Proyecto eliminado correctamente' };
  }
}
