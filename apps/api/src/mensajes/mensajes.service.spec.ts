import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MensajesService } from './mensajes.service';
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

function makeMensaje(overrides = {}) {
  return {
    nombre: 'Ana Apoderada',
    email: 'ana@example.cl',
    telefono: '+56911112222',
    motivo: 'CUOTAS_Y_PAGOS',
    mensaje: 'Consulta sobre el pago de la cuota anual.',
    estado: 'NUEVO',
    fecha_creacion: new Date(),
    ...overrides,
  };
}

describe('MensajesService', () => {
  let service: MensajesService;
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
        MensajesService,
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<MensajesService>(MensajesService);
  });

  afterEach(() => jest.clearAllMocks());

  function setupCollection(docRef: any) {
    const mock: any = { doc: jest.fn().mockReturnValue(docRef) };
    mockFirestore.collection.mockReturnValue(mock);
    return mock;
  }

  function setupBatch() {
    const batch = createMockWriteBatch();
    mockFirestore.batch.mockReturnValue(batch);
    return batch;
  }

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      nombre: 'Ana Apoderada',
      email: 'ana@example.cl',
      telefono: '+56911112222',
      motivo: 'CUOTAS_Y_PAGOS' as const,
      mensaje: 'Consulta sobre el pago de la cuota anual.',
    };

    it('should store the message as a new one', async () => {
      const docRef = createMockDocumentRef('msg-new');
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.create(dto);

      expect(result).toMatchObject({
        id: 'msg-new',
        estado: 'NUEVO',
        nombre: 'Ana Apoderada',
        motivo: 'CUOTAS_Y_PAGOS',
      });
      expect(batch.set).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({ estado: 'NUEVO' }),
      );
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it('should register the creation timestamp', async () => {
      setupCollection(createMockDocumentRef('msg-ts'));
      const batch = setupBatch();

      const result = await service.create(dto);

      expect(result.fecha_creacion).toBeInstanceOf(Date);

      const [, stored] = batch.set.mock.calls[0];
      expect(stored.fecha_creacion).toBeInstanceOf(Date);
    });

    it('should omit the phone number when it was not provided', async () => {
      setupCollection(createMockDocumentRef('msg-nophone'));
      const batch = setupBatch();

      await service.create({ ...dto, telefono: undefined });

      const [, stored] = batch.set.mock.calls[0];
      expect(stored).not.toHaveProperty('telefono');
    });

    it('should record the creation in the audit log as a public submission', async () => {
      setupCollection(createMockDocumentRef('msg-audit'));
      setupBatch();

      await service.create(dto);

      expect(
        mockAuditService.logActionWithTransactionOrBatch,
      ).toHaveBeenCalledTimes(1);

      const [, entry] = (
        mockAuditService.logActionWithTransactionOrBatch as jest.Mock
      ).mock.calls[0];

      expect(entry).toMatchObject({
        accion: 'CREAR_MENSAJE',
        coleccion: 'mensajes',
        documento_id: 'msg-audit',
        usuario_id: 'formulario-publico',
      });
    });

    it('should keep the origin metadata only in the audit log', async () => {
      setupCollection(createMockDocumentRef('msg-origin'));
      const batch = setupBatch();

      await service.create(dto, {
        ip: '190.0.0.1',
        userAgent: 'Mozilla/5.0',
      });

      const [, stored] = batch.set.mock.calls[0];
      expect(stored).not.toHaveProperty('origen_ip');
      expect(stored).not.toHaveProperty('origen_user_agent');

      const [, entry] = (
        mockAuditService.logActionWithTransactionOrBatch as jest.Mock
      ).mock.calls[0];
      expect(entry.payload_nuevo).toMatchObject({
        origen_ip: '190.0.0.1',
        origen_user_agent: 'Mozilla/5.0',
      });
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return every message ordered by creation date descending', async () => {
      const querySnap = createQuerySnapshot([
        { id: 'm1', data: makeMensaje() },
      ]);
      const fakeQuery = { get: jest.fn().mockResolvedValue(querySnap) };
      const collection = { orderBy: jest.fn().mockReturnValue(fakeQuery) };
      mockFirestore.collection.mockReturnValue(collection as any);

      const results = await service.findAll();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('m1');
      expect(collection.orderBy).toHaveBeenCalledWith('fecha_creacion', 'desc');
    });

    it('should filter by status when one is provided', async () => {
      const querySnap = createQuerySnapshot([
        { id: 'm2', data: makeMensaje({ estado: 'ARCHIVADO' }) },
      ]);
      const fakeQuery = { get: jest.fn().mockResolvedValue(querySnap) };
      const orderByQuery = { where: jest.fn().mockReturnValue(fakeQuery) };
      const collection = { orderBy: jest.fn().mockReturnValue(orderByQuery) };
      mockFirestore.collection.mockReturnValue(collection as any);

      const results = await service.findAll('ARCHIVADO');

      expect(results).toHaveLength(1);
      expect(orderByQuery.where).toHaveBeenCalledWith(
        'estado',
        '==',
        'ARCHIVADO',
      );
    });
  });

  // ─── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should throw when the message does not exist', async () => {
      const docRef = createMockDocumentRef('missing');
      docRef.get.mockResolvedValue(createMissingDocSnapshot());
      setupCollection(docRef);

      await expect(
        service.updateStatus('missing', { estado: 'LEIDO' }, 'uid-1', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update the status and register who attended the message', async () => {
      const docRef = createMockDocumentRef('m1');
      docRef.get.mockResolvedValue(createMockDocSnapshot('m1', makeMensaje()));
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.updateStatus(
        'm1',
        { estado: 'LEIDO' },
        'uid-admin',
        'Admin',
      );

      expect(result).toMatchObject({
        id: 'm1',
        estado: 'LEIDO',
        atendido_por: { uid: 'uid-admin', nombre: 'Admin' },
      });
      expect(result.actualizado_en).toBeInstanceOf(Date);
      expect(batch.update).toHaveBeenCalledTimes(1);
      expect(batch.commit).toHaveBeenCalledTimes(1);
    });

    it('should record the status change in the audit log', async () => {
      const docRef = createMockDocumentRef('m1');
      docRef.get.mockResolvedValue(createMockDocSnapshot('m1', makeMensaje()));
      setupCollection(docRef);
      setupBatch();

      await service.updateStatus(
        'm1',
        { estado: 'ARCHIVADO' },
        'uid-admin',
        'Admin',
      );

      const [, entry] = (
        mockAuditService.logActionWithTransactionOrBatch as jest.Mock
      ).mock.calls[0];

      expect(entry).toMatchObject({
        accion: 'ACTUALIZAR_MENSAJE',
        coleccion: 'mensajes',
        documento_id: 'm1',
        usuario_id: 'uid-admin',
      });
      expect(entry.payload_anterior).toMatchObject({ estado: 'NUEVO' });
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should throw when the message does not exist', async () => {
      const docRef = createMockDocumentRef('missing');
      docRef.get.mockResolvedValue(createMissingDocSnapshot());
      setupCollection(docRef);

      await expect(
        service.remove('missing', 'uid-1', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete the message and record it in the audit log', async () => {
      const docRef = createMockDocumentRef('m1');
      docRef.get.mockResolvedValue(createMockDocSnapshot('m1', makeMensaje()));
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.remove('m1', 'uid-admin', 'Admin');

      expect(result).toEqual({ message: 'Mensaje eliminado correctamente' });
      expect(batch.delete).toHaveBeenCalledWith(docRef);
      expect(batch.commit).toHaveBeenCalledTimes(1);

      const [, entry] = (
        mockAuditService.logActionWithTransactionOrBatch as jest.Mock
      ).mock.calls[0];
      expect(entry).toMatchObject({
        accion: 'ELIMINAR_MENSAJE',
        documento_id: 'm1',
      });
    });
  });
});
