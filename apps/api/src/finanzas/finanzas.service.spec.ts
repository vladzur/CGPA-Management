import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { AuditService } from '../common/audit/audit.service';
import {
  createMockFirestore,
  createMockDocumentRef,
  createMockDocSnapshot,
  createMissingDocSnapshot,
  createMockTransaction,
} from '../__mocks__/firebase-admin.mock';

// ─── Mock de firebase-admin ───────────────────────────────────────────────────
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const INST_DATA = { saldo_total: 100000 };
const PROYECTO_DATA = {
  nombre: 'Proyecto A',
  descripcion: 'Desc',
  presupuesto_estimado: 50000,
  monto_ejecutado: 10000,
  monto_recaudado: 0,
  estado: 'PLANIFICACION',
};

const BASE_DTO = {
  tipo: 'INGRESO' as const,
  monto: 5000,
  fecha: new Date('2025-01-01'),
  categoria: 'Aportes',
  descripcion: 'Aporte mensual',
};

describe('FinanzasService', () => {
  let service: FinanzasService;
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let mockAuditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    mockFirestore = createMockFirestore();

    // Stub admin.firestore statics
    (admin.firestore as any).Timestamp = { now: jest.fn(() => new Date()) };
    (admin.firestore as any).FieldValue = {
      serverTimestamp: jest.fn(() => 'SERVER_TS'),
    };
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

    mockAuditService = {
      logAction: jest.fn(),
      logActionWithTransactionOrBatch: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanzasService,
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<FinanzasService>(FinanzasService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Helper: configura los docRefs de colección ────────────────────────────

  function setupCollectionRefs() {
    const transRef = createMockDocumentRef('txn-001');
    const instRef = createMockDocumentRef('liceo_agb');
    const proyectoRef = createMockDocumentRef('proj-001');

    const collectionMock = jest.fn((name: string) => {
      if (name === 'transacciones') return { doc: jest.fn().mockReturnValue(transRef) };
      if (name === 'configuracion') return { doc: jest.fn().mockReturnValue(instRef) };
      if (name === 'proyectos') return { doc: jest.fn().mockReturnValue(proyectoRef) };
      return { doc: jest.fn() };
    });

    mockFirestore.collection.mockImplementation(collectionMock as any);
    return { transRef, instRef, proyectoRef };
  }

  /**
   * Configura runTransaction para ejecutar el callback del servicio.
   * Permite inyectar los snapshots que la transacción debe leer en orden.
   */
  function setupTransactionRun(snapshots: any[]) {
    const mockTxn = createMockTransaction();
    // Cada llamada a t.get() retorna el siguiente snapshot en la lista
    let callCount = 0;
    mockTxn.get.mockImplementation(async () => {
      return snapshots[callCount++] ?? snapshots[snapshots.length - 1];
    });

    mockFirestore.runTransaction.mockImplementation(async (fn: (t: any) => any) => {
      return fn(mockTxn);
    });

    return mockTxn;
  }

  // ─── INGRESO ──────────────────────────────────────────────────────────────

  describe('createTransaction — INGRESO', () => {
    it('debe sumar monto al saldo total y no actualizar proyecto', async () => {
      const { instRef } = setupCollectionRefs();
      const instSnap = createMockDocSnapshot('liceo_agb', INST_DATA);
      const mockTxn = setupTransactionRun([instSnap]);

      const result = await service.createTransaction(BASE_DTO, 'uid-1', 'Tester');

      expect(result.nuevo_saldo_total).toBe(105000); // 100000 + 5000
      expect(result.proyecto_actualizado).toBeNull();
      expect(mockTxn.update).toHaveBeenCalledWith(
        instRef,
        expect.objectContaining({ saldo_total: 105000 }),
      );
    });
  });

  // ─── EGRESO ───────────────────────────────────────────────────────────────

  describe('createTransaction — EGRESO', () => {
    it('debe restar monto del saldo y actualizar monto_ejecutado del proyecto', async () => {
      const { instRef, proyectoRef } = setupCollectionRefs();
      const instSnap = createMockDocSnapshot('liceo_agb', INST_DATA);
      const proyectoSnap = createMockDocSnapshot('proj-001', PROYECTO_DATA);
      const mockTxn = setupTransactionRun([instSnap, proyectoSnap]);

      const egresoDto = { ...BASE_DTO, tipo: 'EGRESO' as const, proyecto_id: 'proj-001' };
      const result = await service.createTransaction(egresoDto, 'uid-1', 'Tester');

      expect(result.nuevo_saldo_total).toBe(95000); // 100000 - 5000
      expect(result.proyecto_actualizado).toEqual({
        id: 'proj-001',
        nuevo_monto_ejecutado: 15000, // 10000 + 5000
      });
      expect(mockTxn.update).toHaveBeenCalledWith(
        proyectoRef,
        expect.objectContaining({ monto_ejecutado: 15000 }),
      );
    });

    it('EGRESO sin proyecto_id solo debe actualizar saldo total', async () => {
      setupCollectionRefs();
      const instSnap = createMockDocSnapshot('liceo_agb', INST_DATA);
      setupTransactionRun([instSnap]);

      const dto = { ...BASE_DTO, tipo: 'EGRESO' as const };
      const result = await service.createTransaction(dto, 'uid-1', 'Tester');

      expect(result.nuevo_saldo_total).toBe(95000);
      expect(result.proyecto_actualizado).toBeNull();
    });
  });

  // ─── Errores ──────────────────────────────────────────────────────────────

  describe('createTransaction — errores', () => {
    it('debe lanzar NotFoundException si el documento liceo_agb no existe', async () => {
      setupCollectionRefs();
      const missingInstSnap = createMissingDocSnapshot();
      // La transacción internamente lanza NotFoundException antes de retornar
      // pero el catch del servicio la re-lanza si es NotFoundException
      setupTransactionRun([missingInstSnap]);

      await expect(
        service.createTransaction(BASE_DTO, 'uid-1', 'Tester'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar NotFoundException si el proyecto especificado no existe', async () => {
      setupCollectionRefs();
      const instSnap = createMockDocSnapshot('liceo_agb', INST_DATA);
      const missingProyecto = createMissingDocSnapshot();
      setupTransactionRun([instSnap, missingProyecto]);

      const dto = { ...BASE_DTO, tipo: 'EGRESO' as const, proyecto_id: 'proj-inexistente' };
      await expect(
        service.createTransaction(dto, 'uid-1', 'Tester'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar ConflictException ante errores genéricos de Firestore', async () => {
      setupCollectionRefs();
      mockFirestore.runTransaction.mockRejectedValue(new Error('Firestore contention'));

      await expect(
        service.createTransaction(BASE_DTO, 'uid-1', 'Tester'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Auditoría ────────────────────────────────────────────────────────────

  describe('auditoría', () => {
    it('debe llamar a auditService.logActionWithTransactionOrBatch en cada transacción', async () => {
      setupCollectionRefs();
      const instSnap = createMockDocSnapshot('liceo_agb', INST_DATA);
      setupTransactionRun([instSnap]);

      await service.createTransaction(BASE_DTO, 'uid-registra', 'Nombre Registra');

      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({
        usuario_id: 'uid-registra',
        nombre_usuario: 'Nombre Registra',
        accion: 'CREAR_TRANSACCION',
        coleccion: 'transacciones',
      });
    });
  });
});
