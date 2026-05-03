import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComunicadosService } from './comunicados.service';
import { AuditService } from '../common/audit/audit.service';
import {
  createMockFirestore,
  createMockDocumentRef,
  createMockDocSnapshot,
  createMissingDocSnapshot,
  createMockWriteBatch,
  createQuerySnapshot,
} from '../__mocks__/firebase-admin.mock';

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';

function makeComunicado(overrides = {}) {
  return {
    titulo: 'Comunicado Test',
    contenido: 'Contenido del comunicado',
    estado: 'BORRADOR',
    fecha_publicacion: new Date(),
    fecha_creacion: new Date(),
    creado_por: { uid: 'uid-admin', nombre: 'Admin' },
    ...overrides,
  };
}

describe('ComunicadosService', () => {
  let service: ComunicadosService;
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
        ComunicadosService,
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ComunicadosService>(ComunicadosService);
  });

  afterEach(() => jest.clearAllMocks());

  function setupBatch() {
    const batch = createMockWriteBatch();
    mockFirestore.batch.mockReturnValue(batch as any);
    return batch;
  }

  function setupCollection(docRef: any) {
    const mock: any = { doc: jest.fn().mockReturnValue(docRef) };
    mockFirestore.collection.mockReturnValue(mock as any);
    return mock;
  }

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('debe crear el comunicado con los campos del server', async () => {
      const docRef = createMockDocumentRef('com-new');
      setupCollection(docRef);
      const batch = setupBatch();

      const dto = {
        titulo: 'Nuevo Comunicado',
        contenido: '# Hola\n\nContenido markdown',
        estado: 'BORRADOR' as const,
        fecha_publicacion: new Date(),
      };

      const result = await service.create(dto, 'uid-admin', 'Admin');

      expect(result).toMatchObject({
        id: 'com-new',
        titulo: 'Nuevo Comunicado',
        estado: 'BORRADOR',
        creado_por: { uid: 'uid-admin', nombre: 'Admin' },
      });
      expect(batch.set).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({ creado_por: { uid: 'uid-admin', nombre: 'Admin' } }),
      );
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it('debe registrar en auditoria al crear', async () => {
      const docRef = createMockDocumentRef('com-aud');
      setupCollection(docRef);
      setupBatch();

      const dto = {
        titulo: 'Test',
        contenido: 'Contenido',
        estado: 'PUBLICADO' as const,
        fecha_publicacion: new Date(),
      };
      await service.create(dto, 'uid-admin', 'Admin');

      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({ accion: 'CREAR_COMUNICADO', coleccion: 'comunicados' });
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('debe retornar todos los comunicados ordenados por fecha_creacion desc', async () => {
      const data = makeComunicado();
      const querySnap = createQuerySnapshot([{ id: 'c1', data }]);
      const fakeQuery = {
        get: jest.fn().mockResolvedValue(querySnap),
      };
      const collection = {
        orderBy: jest.fn().mockReturnValue(fakeQuery),
      };
      mockFirestore.collection.mockReturnValue(collection as any);

      const results = await service.findAll();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('c1');
      expect(collection.orderBy).toHaveBeenCalledWith('fecha_creacion', 'desc');
    });

    it('debe filtrar por estado cuando se provee', async () => {
      const data = makeComunicado({ estado: 'BORRADOR' });
      const querySnap = createQuerySnapshot([{ id: 'c2', data }]);
      const fakeQuery = {
        get: jest.fn().mockResolvedValue(querySnap),
      };
      const orderByQuery = {
        where: jest.fn().mockReturnValue(fakeQuery),
      };
      const collection = {
        orderBy: jest.fn().mockReturnValue(orderByQuery),
      };
      mockFirestore.collection.mockReturnValue(collection as any);

      const results = await service.findAll('BORRADOR');

      expect(results).toHaveLength(1);
      expect(orderByQuery.where).toHaveBeenCalledWith('estado', '==', 'BORRADOR');
    });
  });

  // ─── findAllPublic ─────────────────────────────────────────────────────────

  describe('findAllPublic', () => {
    it('debe retornar solo comunicados PUBLICADO con fecha_publicacion <= now', async () => {
      const data = makeComunicado({ estado: 'PUBLICADO' });
      const querySnap = createQuerySnapshot([{ id: 'c3', data }]);
      const finalQuery = { get: jest.fn().mockResolvedValue(querySnap) };
      const orderedQuery = { orderBy: jest.fn().mockReturnValue(finalQuery) };
      const dateQuery = { where: jest.fn().mockReturnValue(orderedQuery) };
      const estadoQuery = { where: jest.fn().mockReturnValue(dateQuery) };
      mockFirestore.collection.mockReturnValue(estadoQuery as any);

      const results = await service.findAllPublic();

      expect(results).toHaveLength(1);
      expect(estadoQuery.where).toHaveBeenCalledWith('estado', '==', 'PUBLICADO');
      expect(dateQuery.where).toHaveBeenCalledWith('fecha_publicacion', '<=', expect.any(Date));
    });

    it('debe excluir comunicados BORRADOR del endpoint publico', async () => {
      const querySnap = createQuerySnapshot([]);
      const finalQuery = { get: jest.fn().mockResolvedValue(querySnap) };
      const orderedQuery = { orderBy: jest.fn().mockReturnValue(finalQuery) };
      const dateQuery = { where: jest.fn().mockReturnValue(orderedQuery) };
      const estadoQuery = { where: jest.fn().mockReturnValue(dateQuery) };
      mockFirestore.collection.mockReturnValue(estadoQuery as any);

      const results = await service.findAllPublic();

      expect(results).toHaveLength(0);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('debe retornar el comunicado si existe', async () => {
      const docRef = createMockDocumentRef('com-find');
      const snap = createMockDocSnapshot('com-find', makeComunicado());
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      const result = await service.findOne('com-find');

      expect(result.id).toBe('com-find');
      expect(result.titulo).toBe('Comunicado Test');
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      const docRef = createMockDocumentRef('com-missing');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      const collection = { doc: jest.fn().mockReturnValue(docRef) };
      mockFirestore.collection.mockReturnValue(collection as any);

      await expect(service.findOne('com-missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('debe actualizar campos y registrar auditoria con payload_anterior', async () => {
      const docRef = createMockDocumentRef('com-upd');
      const snap = createMockDocSnapshot('com-upd', makeComunicado());
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.update(
        'com-upd',
        { titulo: 'Actualizado' },
        'uid-admin',
        'Admin',
      );

      expect(batch.update).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({ titulo: 'Actualizado' }),
      );
      expect(result.fecha_actualizacion).toBeDefined();

      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({
        accion: 'ACTUALIZAR_COMUNICADO',
        coleccion: 'comunicados',
        documento_id: 'com-upd',
      });
      expect(entry.payload_anterior).toBeDefined();
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      const docRef = createMockDocumentRef('com-nx');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      const collection = { doc: jest.fn().mockReturnValue(docRef) };
      mockFirestore.collection.mockReturnValue(collection as any);

      await expect(
        service.update('com-nx', { titulo: 'Nuevo' }, 'uid', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('debe eliminar el comunicado y registrar auditoria', async () => {
      const docRef = createMockDocumentRef('com-del');
      const snap = createMockDocSnapshot('com-del', makeComunicado());
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.remove('com-del', 'uid-admin', 'Admin');

      expect(result).toEqual({ message: 'Comunicado eliminado correctamente' });
      expect(batch.delete).toHaveBeenCalledWith(docRef);
      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({ accion: 'ELIMINAR_COMUNICADO' });
    });

    it('no debe fallar si el documento ya no existe', async () => {
      const docRef = createMockDocumentRef('com-inexistente');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.remove('com-inexistente', 'uid-admin', 'Admin');

      expect(result).toEqual({ message: 'Comunicado eliminado correctamente' });
      expect(batch.delete).toHaveBeenCalledWith(docRef);
    });
  });
});
