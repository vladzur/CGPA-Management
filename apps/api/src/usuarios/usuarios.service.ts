import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AuditService } from '../common/audit/audit.service';

@Injectable()
export class UsuariosService {
  constructor(private readonly auditService: AuditService) {}

  private get db() {
    return admin.firestore();
  }

  async registerUser(uid: string, email: string, name: string) {
    const userRef = this.db.collection('usuarios').doc(uid);
    const doc = await userRef.get();

    if (doc.exists) {
      throw new BadRequestException('El usuario ya está registrado en la base de datos');
    }

    const newUserData = {
      uid,
      email,
      name,
      activo: false,
      rol: 'PENDIENTE',
      fecha_registro: admin.firestore.FieldValue.serverTimestamp(),
    };

    await userRef.set(newUserData);

    // We can also set custom claims to reflect pending status
    await admin.auth().setCustomUserClaims(uid, { role: 'PENDIENTE', activo: false });

    return { message: 'Usuario registrado correctamente. Pendiente de aprobación.', data: newUserData };
  }

  async getPendingUsers() {
    const snapshot = await this.db.collection('usuarios')
      .where('activo', '==', false)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async approveUser(targetUid: string, role: string, adminUid: string, adminName: string) {
    const userRef = this.db.collection('usuarios').doc(targetUid);
    const doc = await userRef.get();

    if (!doc.exists) {
      throw new NotFoundException(`Usuario ${targetUid} no encontrado`);
    }

    const userData = doc.data() as any;

    const updates = {
      activo: true,
      rol: role,
      fecha_aprobacion: admin.firestore.FieldValue.serverTimestamp(),
      aprobado_por: adminUid,
    };

    const batch = this.db.batch();
    batch.update(userRef, updates);

    // Registrar en auditoría
    this.auditService.logActionWithTransactionOrBatch(batch, {
      usuario_id: adminUid,
      nombre_usuario: adminName,
      accion: 'APROBAR_USUARIO',
      coleccion: 'usuarios',
      documento_id: targetUid,
      payload_anterior: userData,
      payload_nuevo: updates,
    });

    await batch.commit();

    // Actualizar Custom Claims en Firebase Auth
    await admin.auth().setCustomUserClaims(targetUid, { role: role, activo: true });

    return { message: 'Usuario aprobado exitosamente', targetUid, role };
  }
}
