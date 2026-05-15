import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Transaccion, Proyecto } from '@cgpa/shared';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';
import { AuditService } from '../common/audit/audit.service';
import { CryptoSealService } from '../common/crypto/crypto-seal.service';
import { firestoreNow } from '../common/firestore-utils';

@Injectable()
export class FinanzasService {
  constructor(
    private readonly auditService: AuditService,
    private readonly cryptoSealService: CryptoSealService,
  ) {}

  // En producción, esto idealmente se inyecta mediante un proveedor de Firebase,
  // pero para este ejemplo lo accedemos directamente.
  private get db() {
    return admin.firestore();
  }

  /**
   * Crea una transacción financiera utilizando agregación atómica para garantizar
   * la consistencia de los saldos de la institución y el proyecto.
   *
   * Adicionalmente, aplica un sello criptográfico (SHA-256 encadenado) que garantiza
   * la inmutabilidad e intrazabilidad del registro. Cualquier alteración posterior
   * al documento romperá la cadena y será detectable mediante la verificación de integridad.
   */
  async createTransaction(
    dto: CreateTransactionDto,
    userUid: string,
    userName: string,
  ) {
    const db = this.db;

    // Referencias a los documentos involucrados
    const transaccionRef = db.collection('transacciones').doc();
    const instRef = db.collection('configuracion').doc('liceo_agb');

    let proyectoRef: admin.firestore.DocumentReference | null = null;
    if (dto.proyecto_id) {
      proyectoRef = db.collection('proyectos').doc(dto.proyecto_id);
    }

    try {
      // db.runTransaction maneja los reintentos automáticos en caso de conflictos de concurrencia
      return await db.runTransaction(async (t) => {
        // --- 1. LECTURAS (Deben preceder a cualquier operación de escritura) ---
        const instDoc = await t.get(instRef);
        if (!instDoc.exists) {
          throw new NotFoundException(
            'El documento de configuración global (liceo_agb) no existe.',
          );
        }

        let proyectoDoc: admin.firestore.DocumentSnapshot | null = null;
        if (proyectoRef) {
          proyectoDoc = await t.get(proyectoRef);
          if (!proyectoDoc.exists) {
            throw new NotFoundException(
              `El proyecto especificado (${dto.proyecto_id}) no existe.`,
            );
          }
        }

        // --- 1b. LECTURA DEL ÚLTIMO SELLO CRIPTOGRÁFICO ---
        // Se realiza DENTRO de la transacción para garantizar que el snapshot de
        // la cadena es consistente con el estado actual de la base de datos
        // (evita race conditions si dos transacciones se crean simultáneamente).
        const { lastHash, lastSequence } =
          await this.cryptoSealService.getLastTransactionSnapshot(t);
        const nextSequence = lastSequence + 1;

        // --- 2. CÁLCULOS EN MEMORIA ---
        const institucionData = instDoc.data();
        let nuevoSaldoTotal = institucionData?.saldo_total || 0;

        if (dto.tipo === 'INGRESO') {
          nuevoSaldoTotal += dto.monto;
        } else if (dto.tipo === 'EGRESO') {
          nuevoSaldoTotal -= dto.monto;
        }

        let nuevoMontoEjecutadoProyecto = 0;
        if (proyectoDoc && dto.tipo === 'EGRESO') {
          const proyectoData = proyectoDoc.data() as Proyecto;
          nuevoMontoEjecutadoProyecto =
            (proyectoData.monto_ejecutado || 0) + dto.monto;
        }

        // Construimos el documento base respetando el esquema de Zod
        const transaccionBase: Transaccion = {
          ...dto,
          estado: 'CONCILIADO',
          registrado_por: { uid: userUid, nombre: userName },
          // Aseguramos que la fecha es el Timestamp actual del servidor de Firestore
          fecha: firestoreNow(),
        };

        // --- 2b. SELLO CRIPTOGRÁFICO ---
        // Calculamos el hash SHA-256 sobre los campos críticos + el hash anterior.
        // Esto crea una cadena inviolable: si alguien altera este documento en el
        // futuro, el hash recomputado no coincidirá con el almacenado.
        const hashIntegridad = this.cryptoSealService.computeTransactionHash(
          transaccionBase,
          lastHash,
          nextSequence,
        );

        // Documento final con sello criptográfico
        const nuevaTransaccion: Transaccion = {
          ...transaccionBase,
          numero_secuencia: nextSequence,
          hash_previo: lastHash,
          hash_integridad: hashIntegridad,
        };

        // --- 3. ESCRITURAS (solo .set() — NUNCA .update() ni .delete() en transacciones) ---
        // Append-Only: cada transacción financiera es un registro permanente e inmutable.
        t.set(transaccionRef, nuevaTransaccion);

        t.update(instRef, {
          saldo_total: nuevoSaldoTotal,
          ultima_actualizacion: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Solo sumamos al monto ejecutado si es un gasto (EGRESO) del proyecto
        if (proyectoRef && dto.tipo === 'EGRESO') {
          t.update(proyectoRef, {
            monto_ejecutado: nuevoMontoEjecutadoProyecto,
          });
        }

        // Registrar auditoría en la misma transacción
        this.auditService.logActionWithTransactionOrBatch(t, {
          usuario_id: userUid,
          nombre_usuario: userName,
          accion: 'CREAR_TRANSACCION',
          coleccion: 'transacciones',
          documento_id: transaccionRef.id,
          payload_nuevo: nuevaTransaccion,
        });

        // --- 4. RESPUESTA ---
        return {
          id: transaccionRef.id,
          numero_secuencia: nextSequence,
          hash_integridad: hashIntegridad,
          nuevo_saldo_total: nuevoSaldoTotal,
          proyecto_actualizado:
            proyectoRef && dto.tipo === 'EGRESO'
              ? {
                  id: proyectoRef.id,
                  nuevo_monto_ejecutado: nuevoMontoEjecutadoProyecto,
                }
              : null,
        };
      });
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Los fallos de contención (exceso de retries) en transacciones lanzan errores genéricos.
      throw new ConflictException(
        'Fallo de consistencia al procesar la transacción financiera: ' +
          error.message,
      );
    }
  }
}
