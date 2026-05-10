import { Test, TestingModule } from '@nestjs/testing';
import { CryptoSealService, IntegrityBreak } from './crypto-seal.service';
import * as admin from 'firebase-admin';

// ─── Mock de Firestore ────────────────────────────────────────────────────────
const mockGet = jest.fn();
const mockQuery = {
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: mockGet,
};

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => ({
    collection: jest.fn(() => mockQuery),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Crea un Firestore Timestamp mock para las pruebas */
const makeTimestamp = (isoString: string) => ({
  toDate: () => new Date(isoString),
});

/** Construye datos de transacción base para pruebas */
const makeTransactionData = (overrides: Partial<any> = {}) => ({
  tipo: 'INGRESO',
  monto: 1000,
  fecha: makeTimestamp('2024-01-15T10:00:00.000Z'),
  categoria: 'CUOTA',
  descripcion: 'Cuota enero',
  registrado_por: { uid: 'user-123', nombre: 'Admin Test' },
  estado: 'CONCILIADO',
  proyecto_id: null,
  respaldo_url: null,
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('CryptoSealService', () => {
  let service: CryptoSealService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CryptoSealService],
    }).compile();

    service = module.get<CryptoSealService>(CryptoSealService);
  });

  // ── computeTransactionHash ─────────────────────────────────────────────────

  describe('computeTransactionHash', () => {
    it('debe ser determinístico: el mismo input siempre produce el mismo hash', () => {
      const data = makeTransactionData();
      const hash1 = service.computeTransactionHash(data as any, null, 1);
      const hash2 = service.computeTransactionHash(data as any, null, 1);
      expect(hash1).toBe(hash2);
    });

    it('debe producir un hash SHA-256 válido (64 caracteres hexadecimales)', () => {
      const data = makeTransactionData();
      const hash = service.computeTransactionHash(data as any, null, 1);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('debe producir un hash diferente si cambia el monto', () => {
      const data1 = makeTransactionData({ monto: 1000 });
      const data2 = makeTransactionData({ monto: 1001 });
      const hash1 = service.computeTransactionHash(data1 as any, null, 1);
      const hash2 = service.computeTransactionHash(data2 as any, null, 1);
      expect(hash1).not.toBe(hash2);
    });

    it('debe producir un hash diferente si cambia el tipo', () => {
      const ingreso = makeTransactionData({ tipo: 'INGRESO' });
      const egreso = makeTransactionData({ tipo: 'EGRESO' });
      const hash1 = service.computeTransactionHash(ingreso as any, null, 1);
      const hash2 = service.computeTransactionHash(egreso as any, null, 1);
      expect(hash1).not.toBe(hash2);
    });

    it('debe producir un hash diferente según el hash_previo (efecto cadena)', () => {
      const data = makeTransactionData();
      const hashConPrevioNull = service.computeTransactionHash(data as any, null, 2);
      const hashConPrevioReal = service.computeTransactionHash(data as any, 'abc123prev', 2);
      expect(hashConPrevioNull).not.toBe(hashConPrevioReal);
    });

    it('debe producir un hash diferente según el numero_secuencia', () => {
      const data = makeTransactionData();
      const hashSeq1 = service.computeTransactionHash(data as any, null, 1);
      const hashSeq2 = service.computeTransactionHash(data as any, null, 2);
      expect(hashSeq1).not.toBe(hashSeq2);
    });
  });

  // ── getLastTransactionSnapshot ─────────────────────────────────────────────

  describe('getLastTransactionSnapshot', () => {
    it('debe retornar { lastHash: null, lastSequence: 0 } cuando no hay transacciones', async () => {
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

      const result = await service.getLastTransactionSnapshot();
      expect(result).toEqual({ lastHash: null, lastSequence: 0 });
    });

    it('debe retornar el hash e índice de la última transacción', async () => {
      const lastTx = {
        hash_integridad: 'abc123hash',
        numero_secuencia: 5,
      };
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [{ data: () => lastTx }],
      });

      const result = await service.getLastTransactionSnapshot();
      expect(result).toEqual({ lastHash: 'abc123hash', lastSequence: 5 });
    });
  });

  // ── verifyChainIntegrity ───────────────────────────────────────────────────

  describe('verifyChainIntegrity', () => {
    it('debe reportar cadena válida cuando no hay transacciones', async () => {
      mockGet.mockResolvedValueOnce({ docs: [] });

      const report = await service.verifyChainIntegrity();
      expect(report.valida).toBe(true);
      expect(report.total_verificadas).toBe(0);
      expect(report.rupturas).toHaveLength(0);
    });

    it('debe validar correctamente una cadena de 3 transacciones íntegra', async () => {
      // Construir cadena real
      const data1 = makeTransactionData({ monto: 100 });
      const hash1 = service.computeTransactionHash(data1 as any, null, 1);

      const data2 = makeTransactionData({ monto: 200 });
      const hash2 = service.computeTransactionHash(data2 as any, hash1, 2);

      const data3 = makeTransactionData({ monto: 300 });
      const hash3 = service.computeTransactionHash(data3 as any, hash2, 3);

      mockGet.mockResolvedValueOnce({
        docs: [
          { id: 'tx1', data: () => ({ ...data1, numero_secuencia: 1, hash_previo: null, hash_integridad: hash1 }) },
          { id: 'tx2', data: () => ({ ...data2, numero_secuencia: 2, hash_previo: hash1, hash_integridad: hash2 }) },
          { id: 'tx3', data: () => ({ ...data3, numero_secuencia: 3, hash_previo: hash2, hash_integridad: hash3 }) },
        ],
      });

      const report = await service.verifyChainIntegrity();
      expect(report.valida).toBe(true);
      expect(report.total_verificadas).toBe(3);
      expect(report.rupturas).toHaveLength(0);
    });

    it('debe detectar una ruptura cuando un documento fue alterado', async () => {
      const data1 = makeTransactionData({ monto: 100 });
      const hash1 = service.computeTransactionHash(data1 as any, null, 1);

      // Simulamos que el monto fue alterado DESPUÉS de ser guardado
      const data2Alterado = makeTransactionData({ monto: 999_999 }); // monto diferente al original
      const hash2OriginalAntesDeLaAlteracion = service.computeTransactionHash(
        makeTransactionData({ monto: 200 }) as any,
        hash1,
        2,
      );

      mockGet.mockResolvedValueOnce({
        docs: [
          { id: 'tx1', data: () => ({ ...data1, numero_secuencia: 1, hash_previo: null, hash_integridad: hash1 }) },
          { id: 'tx2', data: () => ({
            ...data2Alterado,
            numero_secuencia: 2,
            hash_previo: hash1,
            // El hash guardado corresponde al monto ORIGINAL (200), no al alterado (999999)
            hash_integridad: hash2OriginalAntesDeLaAlteracion,
          })},
        ],
      });

      const report = await service.verifyChainIntegrity();
      expect(report.valida).toBe(false);
      expect(report.rupturas.length).toBeGreaterThan(0);
      const ruptura = report.rupturas.find((r: IntegrityBreak) => r.documento_id === 'tx2');
      expect(ruptura).toBeDefined();
      expect(ruptura?.razon).toContain('Hash de integridad no coincide');
    });

    it('debe detectar una ruptura cuando el hash_previo es incorrecto', async () => {
      const data1 = makeTransactionData({ monto: 100 });
      const hash1 = service.computeTransactionHash(data1 as any, null, 1);

      const data2 = makeTransactionData({ monto: 200 });
      const hash2 = service.computeTransactionHash(data2 as any, hash1, 2);

      mockGet.mockResolvedValueOnce({
        docs: [
          { id: 'tx1', data: () => ({ ...data1, numero_secuencia: 1, hash_previo: null, hash_integridad: hash1 }) },
          { id: 'tx2', data: () => ({
            ...data2,
            numero_secuencia: 2,
            hash_previo: 'hash_incorrecto_manipulado', // <-- manipulado
            hash_integridad: hash2,
          })},
        ],
      });

      const report = await service.verifyChainIntegrity();
      expect(report.valida).toBe(false);
      expect(report.rupturas.some((r: IntegrityBreak) => r.razon.includes('hash_previo no coincide'))).toBe(true);
    });
  });
});
