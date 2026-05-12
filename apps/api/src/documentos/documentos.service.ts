import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { Documento } from '@cgpa/shared';
import { CreateDocumentoDto } from './dto/create-documento.dto';
import { UpdateDocumentoDto } from './dto/update-documento.dto';
import { DocumentoIntegrityService } from './documento-integrity.service';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class DocumentosService {
  constructor(
    private readonly integrityService: DocumentoIntegrityService,
    private readonly auditService: AuditService,
  ) {}

  private get db() {
    return admin.firestore();
  }

  private getSalt(): string {
    const salt = process.env.DOCUMENT_SALT;
    if (!salt) {
      throw new InternalServerErrorException('DOCUMENT_SALT no está configurado en el servidor');
    }
    return salt;
  }

  private getBaseUrl(): string {
    return process.env.VERIFICATION_BASE_URL || 'https://cgpa-liceo-agb.web.app';
  }

  async create(dto: CreateDocumentoDto, userUid: string, userName: string) {
    const docRef = this.db.collection('documentos').doc();

    const nuevo: Documento = {
      ...dto,
      creado_por: { uid: userUid, nombre: userName },
      fecha_creacion: admin.firestore.Timestamp.now() as any,
    };

    const batch = this.db.batch();
    batch.set(docRef, nuevo);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: userUid,
      nombre_usuario: userName,
      accion: 'CREAR_DOCUMENTO',
      coleccion: 'documentos',
      documento_id: docRef.id,
      payload_nuevo: nuevo,
    });

    await batch.commit();
    return { id: docRef.id, ...nuevo };
  }

  async findAll(estado?: string) {
    let query: admin.firestore.Query = this.db
      .collection('documentos')
      .orderBy('fecha_creacion', 'desc');

    if (estado) {
      query = query.where('estado', '==', estado);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  async findOne(id: string) {
    const doc = await this.db.collection('documentos').doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Documento con id ${id} no encontrado`);
    }
    return { id: doc.id, ...doc.data() };
  }

  async findByVerificationUuid(uuid: string) {
    const snapshot = await this.db
      .collection('documentos')
      .where('uuid_verificacion', '==', uuid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return {
        valido: false,
        mensaje: 'Documento no encontrado. El UUID no corresponde a ningún documento emitido por el CGPA.',
      };
    }

    const doc = snapshot.docs[0];
    const data = doc.data() as Documento;

    return {
      valido: true,
      id: doc.id,
      titulo: data.titulo,
      descripcion: data.descripcion,
      monto: data.monto,
      fecha_emision: data.fecha_emision,
      rut_emisor: data.rut_emisor,
      hash_integridad: data.hash_integridad,
      fecha_sellado: data.fecha_sellado,
      creado_por: data.creado_por,
    };
  }

  async update(id: string, dto: UpdateDocumentoDto, userUid: string, userName: string) {
    const docRef = this.db.collection('documentos').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundException(`Documento con id ${id} no encontrado`);
    }

    const existing = doc.data() as Documento;

    if (existing.estado === 'SELLADO') {
      throw new BadRequestException('No se puede modificar un documento que ya fue sellado');
    }

    const updates: any = {
      ...dto,
      fecha_actualizacion: admin.firestore.Timestamp.now() as any,
    };

    const batch = this.db.batch();
    batch.update(docRef, updates);

    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: userUid,
      nombre_usuario: userName,
      accion: 'ACTUALIZAR_DOCUMENTO',
      coleccion: 'documentos',
      documento_id: id,
      payload_anterior: existing,
      payload_nuevo: updates,
    });

    await batch.commit();
    return { id, ...existing, ...updates };
  }

  async sellar(id: string, userUid: string, userName: string) {
    const docRef = this.db.collection('documentos').doc(id);
    const salt = this.getSalt();
    const baseUrl = this.getBaseUrl();

    return this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new NotFoundException(`Documento con id ${id} no encontrado`);
      }

      const data = doc.data() as Documento;

      if (data.estado === 'SELLADO') {
        throw new BadRequestException('El documento ya fue sellado anteriormente');
      }

      const uuid = uuidv4();

      const fechaEmision = data.fecha_emision instanceof Date
        ? data.fecha_emision
        : new Date((data.fecha_emision as any).toDate?.() ?? data.fecha_emision);

      const hash = this.integrityService.computeHash(
        id,
        fechaEmision.toISOString(),
        data.monto,
        data.rut_emisor,
        salt,
      );

      const qrBase64 = await this.integrityService.generateQR(
        `${baseUrl}/validar/${uuid}`,
      );

      const updates: any = {
        estado: 'SELLADO',
        hash_integridad: hash,
        uuid_verificacion: uuid,
        qr_base64: qrBase64,
        salt,
        fecha_sellado: admin.firestore.FieldValue.serverTimestamp(),
      };

      transaction.update(docRef, updates);

      // Auditoría dentro de la misma transacción
      this.auditService.logActionWithTransactionOrBatch(transaction, {
        usuario_id: userUid,
        nombre_usuario: userName,
        accion: 'SELLAR_DOCUMENTO',
        coleccion: 'documentos',
        documento_id: id,
        payload_anterior: data,
        payload_nuevo: { ...data, ...updates },
      });

      return { id, ...data, ...updates };
    });
  }

  async generatePdf(id: string): Promise<Buffer> {
    const doc = await this.db.collection('documentos').doc(id).get();

    if (!doc.exists) {
      throw new NotFoundException(`Documento con id ${id} no encontrado`);
    }

    const data = doc.data() as Documento;

    if (data.estado !== 'SELLADO') {
      throw new BadRequestException('Solo se puede generar PDF de documentos sellados');
    }

    return this.integrityService.generatePDFBuffer(data);
  }

  async remove(id: string, userUid: string, userName: string) {
    const docRef = this.db.collection('documentos').doc(id);
    const doc = await docRef.get();
    const data = doc.exists ? doc.data() : null;

    const batch = this.db.batch();
    batch.delete(docRef);

    if (data) {
      this.auditService.logActionWithTransactionOrBatch(batch, {
        usuario_id: userUid,
        nombre_usuario: userName,
        accion: 'ELIMINAR_DOCUMENTO',
        coleccion: 'documentos',
        documento_id: id,
        payload_anterior: data,
      });
    }

    await batch.commit();
    return { message: 'Documento eliminado correctamente' };
  }
}
