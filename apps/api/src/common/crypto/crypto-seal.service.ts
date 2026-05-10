import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import { Transaccion } from '@cgpa/shared';

/**
 * Campos críticos que participan en el cálculo del hash de integridad.
 * El orden canónico de las claves es importante para garantizar determinismo.
 */
const HASH_FIELDS: (keyof Transaccion)[] = [
  'tipo',
  'monto',
  'fecha',
  'categoria',
  'descripcion',
  'registrado_por',
  'proyecto_id',
  'respaldo_url',
];

export interface SealSnapshot {
  /** Hash de la última transacción registrada en la cadena */
  lastHash: string | null;
  /** Número de secuencia de la última transacción (0 si no existe ninguna) */
  lastSequence: number;
}

export interface IntegrityReport {
  /** true si toda la cadena es válida */
  valida: boolean;
  /** Número total de transacciones verificadas */
  total_verificadas: number;
  /** Lista de rupturas detectadas (vacía si todo está correcto) */
  rupturas: IntegrityBreak[];
  /** Mensaje resumen legible */
  mensaje: string;
}

export interface IntegrityBreak {
  /** ID del documento de Firestore donde se detectó la ruptura */
  documento_id: string;
  /** Número de secuencia del documento con ruptura */
  numero_secuencia: number;
  /** Descripción del problema */
  razon: string;
}

/** Tipo interno: transacción con todos los campos de integridad garantizados (no opcionales) */
type SealedTransaccion = Transaccion &
  Required<Pick<Transaccion, 'hash_integridad' | 'hash_previo' | 'numero_secuencia'>>;

@Injectable()
export class CryptoSealService {
  private readonly logger = new Logger(CryptoSealService.name);

  private get db() {
    return admin.firestore();
  }

  /**
   * Genera un hash SHA-256 determinístico para una transacción.
   *
   * El hash incluye:
   *  - Los campos de negocio críticos (tipo, monto, fecha, etc.)
   *  - El hash de la transacción anterior (encadenamiento)
   *  - El número de secuencia de esta transacción
   *
   * Al incluir hash_previo en el input, se crea una cadena inviolable:
   * modificar cualquier transacción pasada invalida TODOS los hashes
   * subsiguientes, lo que hace el fraude matemáticamente detectable.
   */
  computeTransactionHash(
    data: Omit<Transaccion, 'hash_integridad' | 'hash_previo' | 'numero_secuencia'>,
    hashPrevio: string | null,
    numeroSecuencia: number,
  ): string {
    // Construimos el objeto canónico con campos en orden fijo
    const canonicalObj: Record<string, any> = {};

    for (const field of HASH_FIELDS) {
      const value = (data as any)[field];

      if (value === undefined) {
        // Los campos opcionales ausentes se representan como null para consistencia
        canonicalObj[field] = null;
      } else if (value && typeof value === 'object' && 'toDate' in value) {
        // Convertir Firestore Timestamp a ISO string para serialización estable
        canonicalObj[field] = value.toDate().toISOString();
      } else if (value instanceof Date) {
        canonicalObj[field] = value.toISOString();
      } else {
        canonicalObj[field] = value;
      }
    }

    // Incluir metadatos de cadena
    canonicalObj['__hash_previo__'] = hashPrevio;
    canonicalObj['__numero_secuencia__'] = numeroSecuencia;

    const payload = JSON.stringify(canonicalObj);
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Obtiene el snapshot de la última transacción en la cadena.
   * Usado para encadenar correctamente la próxima transacción.
   * DEBE llamarse dentro de la misma transacción de Firestore para evitar race conditions.
   */
  async getLastTransactionSnapshot(
    transaction?: admin.firestore.Transaction,
  ): Promise<SealSnapshot> {
    const query = this.db
      .collection('transacciones')
      .orderBy('numero_secuencia', 'desc')
      .limit(1);

    const snapshot = transaction ? await transaction.get(query) : await query.get();

    if (snapshot.empty) {
      return { lastHash: null, lastSequence: 0 };
    }

    const lastDoc = snapshot.docs[0].data() as Transaccion;
    return {
      lastHash: lastDoc.hash_integridad ?? null,
      lastSequence: lastDoc.numero_secuencia ?? 0,
    };
  }

  /**
   * Verifica la integridad matemática de toda la cadena de transacciones.
   *
   * Algoritmo:
   *  1. Obtiene todas las transacciones ordenadas por numero_secuencia ASC.
   *  2. Para cada transacción, recomputa el hash con los datos almacenados.
   *  3. Compara el hash recomputado con el hash_integridad guardado.
   *  4. Verifica que hash_previo coincide con el hash_integridad del doc anterior.
   *
   * Si hay alguna discrepancia, significa que el registro fue alterado.
   *
   * @param limit - Número máximo de transacciones a verificar (por defecto todas)
   */
  async verifyChainIntegrity(limit?: number): Promise<IntegrityReport> {
    this.logger.log('Iniciando verificación de integridad de cadena criptográfica...');

    let query = this.db
      .collection('transacciones')
      .orderBy('numero_secuencia', 'asc') as admin.firestore.Query;

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    const rupturas: IntegrityBreak[] = [];
    let prevHash: string | null = null;
    let prevSequence = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as SealedTransaccion;

      // 1. Verificar que el hash_previo encadena correctamente
      if (data.hash_previo !== prevHash) {
        rupturas.push({
          documento_id: doc.id,
          numero_secuencia: data.numero_secuencia,
          razon: `hash_previo no coincide. Esperado: "${prevHash}", Encontrado: "${data.hash_previo}"`,
        });
      }

      // 2. Verificar continuidad de secuencia
      if (data.numero_secuencia !== prevSequence + 1) {
        rupturas.push({
          documento_id: doc.id,
          numero_secuencia: data.numero_secuencia,
          razon: `Ruptura en numero_secuencia. Esperado: ${prevSequence + 1}, Encontrado: ${data.numero_secuencia}`,
        });
      }

      // 3. Recomputar hash y comparar contra el almacenado
      const recomputedHash = this.computeTransactionHash(
        data,
        data.hash_previo,
        data.numero_secuencia,
      );

      if (recomputedHash !== data.hash_integridad) {
        rupturas.push({
          documento_id: doc.id,
          numero_secuencia: data.numero_secuencia,
          razon: `Hash de integridad no coincide. El documento fue modificado después de su registro. Hash esperado: "${recomputedHash}", Hash almacenado: "${data.hash_integridad}"`,
        });
      }

      prevHash = data.hash_integridad;
      prevSequence = data.numero_secuencia;
    }

    const valida = rupturas.length === 0;
    const total = snapshot.docs.length;

    const report: IntegrityReport = {
      valida,
      total_verificadas: total,
      rupturas,
      mensaje: valida
        ? `✅ Cadena íntegra. Se verificaron ${total} transacciones sin detectar alteraciones.`
        : `⚠️ Se detectaron ${rupturas.length} ruptura(s) en la cadena criptográfica de ${total} transacciones. El historial puede haber sido alterado.`,
    };

    this.logger.log(report.mensaje);
    return report;
  }
}
