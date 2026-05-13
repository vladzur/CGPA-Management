import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { Comunicado } from '@cgpa/shared';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class ComunicadosService {
  constructor(private readonly auditService: AuditService) {}

  private get db() {
    return admin.firestore();
  }

  async create(
    createComunicadoDto: CreateComunicadoDto,
    userUid: string,
    userName: string,
  ) {
    const comunicadoRef = this.db.collection('comunicados').doc();

    const nuevoComunicado: Comunicado = {
      ...createComunicadoDto,
      creado_por: { uid: userUid, nombre: userName },
      fecha_creacion: admin.firestore.Timestamp.now() as any,
    };

    const batch = this.db.batch();
    batch.set(comunicadoRef, nuevoComunicado);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: userUid,
      nombre_usuario: userName,
      accion: 'CREAR_COMUNICADO',
      coleccion: 'comunicados',
      documento_id: comunicadoRef.id,
      payload_nuevo: nuevoComunicado,
    });

    await batch.commit();
    return { id: comunicadoRef.id, ...nuevoComunicado };
  }

  async findAll(estado?: string) {
    let query: admin.firestore.Query = this.db
      .collection('comunicados')
      .orderBy('fecha_creacion', 'desc');

    if (estado) {
      query = query.where('estado', '==', estado);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async findAllPublic() {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await this.db
      .collection('comunicados')
      .where('estado', '==', 'PUBLICADO')
      .where('fecha_publicacion', '<=', now)
      .orderBy('fecha_publicacion', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async findOne(id: string) {
    const doc = await this.db.collection('comunicados').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Comunicado con id ${id} no encontrado`);
    }
    return { id: doc.id, ...doc.data() };
  }

  async update(
    id: string,
    updateComunicadoDto: UpdateComunicadoDto,
    userUid: string,
    userName: string,
  ) {
    const docRef = this.db.collection('comunicados').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundException(`Comunicado con id ${id} no encontrado`);
    }

    const data = doc.data() as Comunicado;
    const updates: any = {
      ...updateComunicadoDto,
      fecha_actualizacion: admin.firestore.Timestamp.now() as any,
    };

    const batch = this.db.batch();
    batch.update(docRef, updates);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: userUid,
      nombre_usuario: userName,
      accion: 'ACTUALIZAR_COMUNICADO',
      coleccion: 'comunicados',
      documento_id: id,
      payload_anterior: data,
      payload_nuevo: updates,
    });

    await batch.commit();
    return { id, ...updates };
  }

  async remove(id: string, userUid: string, userName: string) {
    const docRef = this.db.collection('comunicados').doc(id);
    const doc = await docRef.get();
    const data = doc.exists ? doc.data() : null;

    const batch = this.db.batch();
    batch.delete(docRef);

    if (data) {
      this.auditService.logActionWithTransactionOrBatch(batch, {
        usuario_id: userUid,
        nombre_usuario: userName,
        accion: 'ELIMINAR_COMUNICADO',
        coleccion: 'comunicados',
        documento_id: id,
        payload_anterior: data,
      });
    }

    await batch.commit();
    return { message: 'Comunicado eliminado correctamente' };
  }
}
