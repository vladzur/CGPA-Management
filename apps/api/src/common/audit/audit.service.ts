import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

export interface AuditLogEntry {
  usuario_id: string;
  nombre_usuario: string;
  accion: string;
  coleccion: string;
  documento_id: string;
  payload_anterior?: any;
  payload_nuevo?: any;
  ip_address?: string;
}

@Injectable()
export class AuditService {
  private get db() {
    return admin.firestore();
  }

  /**
   * Registra una acción en la colección de auditoría.
   */
  async logAction(entry: AuditLogEntry) {
    const auditRef = this.db.collection('auditoria').doc();
    
    // Convert undefined to null for Firestore or remove them
    const dataToSave = {
      ...entry,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    // Remove undefined values
    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof typeof dataToSave] === undefined) {
        delete dataToSave[key as keyof typeof dataToSave];
      }
    });

    await auditRef.set(dataToSave);
  }

  /**
   * Crea una entrada de auditoría como parte de un batch o transacción
   * para asegurar atomicidad.
   */
  logActionWithTransactionOrBatch(
    tOrBatch: admin.firestore.Transaction | admin.firestore.WriteBatch,
    entry: AuditLogEntry
  ) {
    const auditRef = this.db.collection('auditoria').doc();
    
    const dataToSave = {
      ...entry,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    };

    Object.keys(dataToSave).forEach(key => {
      if (dataToSave[key as keyof typeof dataToSave] === undefined) {
        delete dataToSave[key as keyof typeof dataToSave];
      }
    });

    // Use type assertion to avoid TS union issues since both have the same runtime set signature for this use case
    if ('set' in tOrBatch) {
      (tOrBatch as admin.firestore.WriteBatch).set(auditRef, dataToSave);
    }
  }
}
