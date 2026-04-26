import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { AuditService } from '../common/audit/audit.service';
import {
  createMockFirestore,
  createMockDocumentRef,
  createMockDocSnapshot,
  createMissingDocSnapshot,
  createMockWriteBatch,
  createEmptyQuerySnapshot,
  createQuerySnapshot,
} from '../__mocks__/firebase-admin.mock';

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';

// ─── Fixture de Proyecto ───────────────────────────────────────────────────────
function makeProyecto(overrides = {}) {
  return {
    nombre: 'Proyecto Test',
    descripcion: 'Descripción del proyecto',
    estado: 'PLANIFICACION',
    presupuesto_estimado: 100000,
    monto_recaudado: 0,
    monto_ejecutado: 40000,
    responsable: { uid: 'uid-resp', nombre: 'Responsable' },
    fecha_inicio: new Date(),
    ...overrides,
  };
}

describe('ProyectosService', () => {
  let service: ProyectosService;
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let mockAuditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    mockFirestore = createMockFirestore();
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
        ProyectosService,
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ProyectosService>(ProyectosService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function setupBatch() {
    const batch = createMockWriteBatch();
    mockFirestore.batch.mockReturnValue(batch as any);
    return batch;
  }

  function setupCollection(docRef: any, getResult?: any) {
    const mock: any = { doc: jest.fn().mockReturnValue(docRef) };
    if (getResult !== undefined) {
      mock.get = jest.fn().mockResolvedValue(getResult);
    }
    mockFirestore.collection.mockReturnValue(mock as any);
    return mock;
  }

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('debe crear el proyecto con estado PLANIFICACION y montos en 0', async () => {
      const docRef = createMockDocumentRef('proj-new');
      setupCollection(docRef);
      const batch = setupBatch();

      const dto = {
        nombre: 'Nuevo Proyecto',
        descripcion: 'Desc',
        presupuesto_estimado: 50000,
        responsable: { uid: 'uid-r', nombre: 'Resp' },
      };

      const result = await service.create(dto, 'uid-admin', 'Admin');

      expect(result).toMatchObject({
        id: 'proj-new',
        estado: 'PLANIFICACION',
        monto_recaudado: 0,
        monto_ejecutado: 0,
      });
      expect(batch.set).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({ estado: 'PLANIFICACION', monto_ejecutado: 0 }),
      );
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it('debe registrar en auditoría al crear', async () => {
      const docRef = createMockDocumentRef('proj-aud');
      setupCollection(docRef);
      setupBatch();

      const dto = { nombre: 'P', descripcion: 'D', presupuesto_estimado: 1000, responsable: { uid: 'u', nombre: 'N' } };
      await service.create(dto, 'uid-admin', 'Admin');

      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({ accion: 'CREAR_PROYECTO', coleccion: 'proyectos' });
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('debe retornar lista de proyectos con avance_financiero calculado', async () => {
      const proyectoData = makeProyecto({ presupuesto_estimado: 100000, monto_ejecutado: 40000 });
      const querySnap = createQuerySnapshot([{ id: 'p1', data: proyectoData }]);
      const collection = { get: jest.fn().mockResolvedValue(querySnap) };
      mockFirestore.collection.mockReturnValue(collection as any);

      const results = await service.findAll();

      expect(results).toHaveLength(1);
      expect(results[0].avance_financiero).toBe(40); // 40000/100000 * 100
    });

    it('avance_financiero debe ser 0 si presupuesto_estimado es 0', async () => {
      const proyectoData = makeProyecto({ presupuesto_estimado: 0, monto_ejecutado: 0 });
      const querySnap = createQuerySnapshot([{ id: 'p2', data: proyectoData }]);
      const collection = { get: jest.fn().mockResolvedValue(querySnap) };
      mockFirestore.collection.mockReturnValue(collection as any);

      const results = await service.findAll();
      expect(results[0].avance_financiero).toBe(0);
    });

    it('avance_financiero debe ser máximo 100 (capped)', async () => {
      const proyectoData = makeProyecto({ presupuesto_estimado: 10000, monto_ejecutado: 99999 });
      const querySnap = createQuerySnapshot([{ id: 'p3', data: proyectoData }]);
      const collection = { get: jest.fn().mockResolvedValue(querySnap) };
      mockFirestore.collection.mockReturnValue(collection as any);

      const results = await service.findAll();
      expect(results[0].avance_financiero).toBe(100);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('debe retornar el proyecto con avance_financiero calculado', async () => {
      const docRef = createMockDocumentRef('proj-find');
      const snap = createMockDocSnapshot('proj-find', makeProyecto({ presupuesto_estimado: 200000, monto_ejecutado: 100000 }));
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      const result = await service.findOne('proj-find');

      expect(result.id).toBe('proj-find');
      expect(result.avance_financiero).toBe(50); // 50%
    });

    it('debe lanzar NotFoundException si el proyecto no existe', async () => {
      const docRef = createMockDocumentRef('proj-missing');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      const collection = { doc: jest.fn().mockReturnValue(docRef) };
      mockFirestore.collection.mockReturnValue(collection as any);

      await expect(service.findOne('proj-missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('debe actualizar los campos y recalcular avance_financiero si cambia el presupuesto', async () => {
      const docRef = createMockDocumentRef('proj-upd');
      const snap = createMockDocSnapshot('proj-upd', makeProyecto({ monto_ejecutado: 50000 }));
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.update(
        'proj-upd',
        { presupuesto_estimado: 200000 },
        'uid-admin',
        'Admin',
      );

      expect(result).toMatchObject({ id: 'proj-upd', presupuesto_estimado: 200000 });
      expect(result.avance_financiero).toBe(25); // 50000/200000 * 100
      expect(batch.update).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({ avance_financiero: 25 }),
      );
    });

    it('debe lanzar NotFoundException si el proyecto no existe', async () => {
      const docRef = createMockDocumentRef('proj-nx');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      const collection = { doc: jest.fn().mockReturnValue(docRef) };
      mockFirestore.collection.mockReturnValue(collection as any);

      await expect(
        service.update('proj-nx', { nombre: 'Nuevo nombre' }, 'uid', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('debe lanzar BadRequestException si el proyecto tiene transacciones asociadas', async () => {
      const nonEmptyQuerySnap = createQuerySnapshot([{ id: 'txn-1', data: { monto: 1000 } }]);

      // Primero: collection('transacciones').where().limit().get() → non-empty
      const txnCollection = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(nonEmptyQuerySnap),
      };

      mockFirestore.collection.mockImplementation((name: string) => {
        if (name === 'transacciones') return txnCollection as any;
        return { doc: jest.fn() } as any;
      });

      await expect(
        service.remove('proj-del', 'uid-admin', 'Admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe eliminar el proyecto y registrar auditoría', async () => {
      const docRef = createMockDocumentRef('proj-del-ok');
      const emptyQuerySnap = createEmptyQuerySnapshot();
      const snap = createMockDocSnapshot('proj-del-ok', makeProyecto());
      docRef.get.mockResolvedValue(snap as any);

      const txnCollection = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(emptyQuerySnap),
      };
      const proyCollection = { doc: jest.fn().mockReturnValue(docRef) };

      mockFirestore.collection.mockImplementation((name: string) => {
        if (name === 'transacciones') return txnCollection as any;
        return proyCollection as any;
      });
      const batch = setupBatch();

      const result = await service.remove('proj-del-ok', 'uid-admin', 'Admin');

      expect(result).toEqual({ message: 'Proyecto eliminado correctamente' });
      expect(batch.delete).toHaveBeenCalledWith(docRef);
      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({ accion: 'ELIMINAR_PROYECTO' });
    });
  });
});
