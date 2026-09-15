import { Injectable, NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Mensaje, MensajeEstado } from '@cgpa/shared';
import { CreateMensajeDto } from './dto/create-mensaje.dto';
import { UpdateMensajeDto } from './dto/update-mensaje.dto';
import { AuditService } from '../common/audit/audit.service';
import { firestoreNow } from '../common/firestore-utils';

/** Datos de contexto del envío, usados solo para el registro de auditoría. */
export interface MensajeContext {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class MensajesService {
  constructor(private readonly auditService: AuditService) {}

  private get db() {
    return admin.firestore();
  }

  /**
   * Registra un mensaje enviado desde el formulario público de contacto.
   * Todo mensaje nuevo queda en estado `NUEVO` a la espera de la directiva.
   */
  async create(
    createMensajeDto: CreateMensajeDto,
    context: MensajeContext = {},
  ) {
    const mensajeRef = this.db.collection('mensajes').doc();

    // Los datos de contexto (IP, agente de usuario) se guardan solo en auditoría
    // para no acumular datos personales en la bandeja de la directiva.
    const nuevoMensaje: Mensaje = {
      nombre: createMensajeDto.nombre,
      email: createMensajeDto.email,
      motivo: createMensajeDto.motivo,
      mensaje: createMensajeDto.mensaje,
      estado: 'NUEVO',
      fecha_creacion: firestoreNow(),
      ...(createMensajeDto.telefono
        ? { telefono: createMensajeDto.telefono }
        : {}),
    };

    const batch = this.db.batch();
    batch.set(mensajeRef, nuevoMensaje);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: 'formulario-publico',
      nombre_usuario: createMensajeDto.nombre,
      accion: 'CREAR_MENSAJE',
      coleccion: 'mensajes',
      documento_id: mensajeRef.id,
      payload_nuevo: {
        ...nuevoMensaje,
        ...(context.ip ? { origen_ip: context.ip } : {}),
        ...(context.userAgent ? { origen_user_agent: context.userAgent } : {}),
      },
    });

    await batch.commit();
    return { id: mensajeRef.id, ...nuevoMensaje };
  }

  /** Lista los mensajes recibidos, opcionalmente filtrados por estado. */
  async findAll(estado?: MensajeEstado) {
    let query: admin.firestore.Query = this.db
      .collection('mensajes')
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

  /** Cambia el estado de atención de un mensaje y deja constancia en auditoría. */
  async updateStatus(
    id: string,
    updateMensajeDto: UpdateMensajeDto,
    userUid: string,
    userName: string,
  ) {
    const docRef = this.db.collection('mensajes').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundException(`Mensaje con id ${id} no encontrado`);
    }

    const data = doc.data() as Mensaje;

    const updates = {
      ...updateMensajeDto,
      actualizado_en: firestoreNow(),
      atendido_por: { uid: userUid, nombre: userName },
    };

    const batch = this.db.batch();
    batch.update(docRef, updates);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: userUid,
      nombre_usuario: userName,
      accion: 'ACTUALIZAR_MENSAJE',
      coleccion: 'mensajes',
      documento_id: id,
      payload_anterior: data,
      payload_nuevo: updates,
    });

    await batch.commit();
    return { id, ...updates };
  }

  /** Elimina un mensaje de la bandeja. */
  async remove(id: string, userUid: string, userName: string) {
    const docRef = this.db.collection('mensajes').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundException(`Mensaje con id ${id} no encontrado`);
    }

    const data = doc.data() as Mensaje;

    const batch = this.db.batch();
    batch.delete(docRef);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: userUid,
      nombre_usuario: userName,
      accion: 'ELIMINAR_MENSAJE',
      coleccion: 'mensajes',
      documento_id: id,
      payload_anterior: data,
    });

    await batch.commit();
    return { message: 'Mensaje eliminado correctamente' };
  }
}
