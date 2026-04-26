import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import {
  createMockFirestore,
  createMockDocumentRef,
  createMockWriteBatch,
} from '../../__mocks__/firebase-admin.mock';

// Mock global de firebase-admin
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  firestore_: {
    FieldValue: { serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP') },
  },
}));

import * as admin from 'firebase-admin';

describe('AuditService', () => {
  let service: AuditService;
  let mockFirestore: ReturnType<typeof createMockFirestore>;

  beforeEach(async () => {
    mockFirestore = createMockFirestore();
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

    // Stub firestore.FieldValue.serverTimestamp
    (admin.firestore as any).FieldValue = {
      serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('logAction', () => {
    it('debe guardar la entrada de auditoría en Firestore con serverTimestamp', async () => {
      const mockRef = createMockDocumentRef('audit-001');
      const mockCollection = {
        doc: jest.fn().mockReturnValue(mockRef),
      };
      mockFirestore.collection.mockReturnValue(mockCollection as any);
      mockRef.set.mockResolvedValue(undefined as any);

      await service.logAction({
        usuario_id: 'uid-1',
        nombre_usuario: 'Vlad',
        accion: 'TEST',
        coleccion: 'test',
        documento_id: 'doc-1',
      });

      expect(mockFirestore.collection).toHaveBeenCalledWith('auditoria');
      expect(mockRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          usuario_id: 'uid-1',
          accion: 'TEST',
          timestamp: 'SERVER_TIMESTAMP',
        }),
      );
    });

    it('debe eliminar campos undefined antes de guardar', async () => {
      const mockRef = createMockDocumentRef('audit-002');
      const mockCollection = { doc: jest.fn().mockReturnValue(mockRef) };
      mockFirestore.collection.mockReturnValue(mockCollection as any);
      mockRef.set.mockResolvedValue(undefined as any);

      await service.logAction({
        usuario_id: 'uid-1',
        nombre_usuario: 'Vlad',
        accion: 'TEST',
        coleccion: 'test',
        documento_id: 'doc-1',
        payload_anterior: undefined, // debe eliminarse
        payload_nuevo: { foo: 'bar' },
      });

      const savedData = (mockRef.set as jest.Mock).mock.calls[0][0];
      expect(savedData).not.toHaveProperty('payload_anterior');
      expect(savedData).toHaveProperty('payload_nuevo', { foo: 'bar' });
    });
  });

  describe('logActionWithTransactionOrBatch', () => {
    it('debe llamar a batch.set() con la entrada de auditoría', () => {
      const batch = createMockWriteBatch();
      const mockRef = createMockDocumentRef('audit-003');
      const mockCollection = { doc: jest.fn().mockReturnValue(mockRef) };
      mockFirestore.collection.mockReturnValue(mockCollection as any);

      service.logActionWithTransactionOrBatch(batch as any, {
        usuario_id: 'uid-1',
        nombre_usuario: 'Admin',
        accion: 'CREAR_PROYECTO',
        coleccion: 'proyectos',
        documento_id: 'proj-1',
        payload_nuevo: { nombre: 'Proyecto Test' },
      });

      expect(batch.set).toHaveBeenCalledWith(
        mockRef,
        expect.objectContaining({
          accion: 'CREAR_PROYECTO',
          timestamp: 'SERVER_TIMESTAMP',
        }),
      );
    });

    it('debe eliminar campos undefined del batch entry', () => {
      const batch = createMockWriteBatch();
      const mockRef = createMockDocumentRef('audit-004');
      const mockCollection = { doc: jest.fn().mockReturnValue(mockRef) };
      mockFirestore.collection.mockReturnValue(mockCollection as any);

      service.logActionWithTransactionOrBatch(batch as any, {
        usuario_id: 'uid-1',
        nombre_usuario: 'Admin',
        accion: 'ELIMINAR',
        coleccion: 'proyectos',
        documento_id: 'proj-x',
        payload_anterior: undefined,
      });

      const savedData = (batch.set as jest.Mock).mock.calls[0][1];
      expect(savedData).not.toHaveProperty('payload_anterior');
    });
  });
});
