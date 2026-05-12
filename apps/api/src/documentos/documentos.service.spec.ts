import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { DocumentoIntegrityService } from './documento-integrity.service';
import { AuditService } from '../common/audit/audit.service';
import {
  createMockFirestore,
  createMockDocumentRef,
  createMockDocSnapshot,
  createMissingDocSnapshot,
  createMockWriteBatch,
  createMockTransaction,
  createQuerySnapshot,
} from '../__mocks__/firebase-admin.mock';

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';

function makeDocumento(overrides = {}) {
  return {
    titulo: 'Balance Anual 2026',
    descripcion: 'Balance financiero del año',
    monto: 1500000,
    fecha_emision: new Date('2026-03-15'),
    rut_emisor: '12.345.678-9',
    estado: 'BORRADOR' as const,
    creado_por: { uid: 'uid-admin', nombre: 'Admin' },
    fecha_creacion: new Date(),
    ...overrides,
  };
}

describe('DocumentosService', () => {
  let service: DocumentosService;
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let mockAuditService: jest.Mocked<AuditService>;
  let mockIntegrityService: jest.Mocked<DocumentoIntegrityService>;

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

    mockIntegrityService = {
      computeHash: jest.fn().mockReturnValue('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'),
      generateQR: jest.fn().mockResolvedValue('data:image/png;base64,mockQR'),
      generatePDFBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentosService,
        { provide: AuditService, useValue: mockAuditService },
        { provide: DocumentoIntegrityService, useValue: mockIntegrityService },
      ],
    }).compile();

    service = module.get<DocumentosService>(DocumentosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.DOCUMENT_SALT;
    delete process.env.VERIFICATION_BASE_URL;
  });

  function setupBatch() {
    const batch = createMockWriteBatch();
    mockFirestore.batch.mockReturnValue(batch as any);
    return batch;
  }

  function setupTransaction() {
    const t = createMockTransaction();
    mockFirestore.runTransaction.mockImplementation(async (fn: any) => fn(t));
    return t;
  }

  function setupCollection(docRef: any) {
    const mock: any = { doc: jest.fn().mockReturnValue(docRef) };
    mockFirestore.collection.mockReturnValue(mock as any);
    return mock;
  }

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('debe crear el documento en estado BORRADOR con los campos del server', async () => {
      const docRef = createMockDocumentRef('doc-new');
      setupCollection(docRef);
      const batch = setupBatch();

      const dto = {
        titulo: 'Balance Anual',
        descripcion: 'Balance 2026',
        monto: 2000000,
        fecha_emision: new Date('2026-03-15'),
        rut_emisor: '12.345.678-9',
        estado: 'BORRADOR' as const,
      };

      const result = await service.create(dto, 'uid-admin', 'Admin');

      expect(result).toMatchObject({
        id: 'doc-new',
        titulo: 'Balance Anual',
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
      const docRef = createMockDocumentRef('doc-aud');
      setupCollection(docRef);
      setupBatch();

      const dto = {
        titulo: 'Test',
        descripcion: 'Desc',
        monto: 10000,
        fecha_emision: new Date(),
        rut_emisor: '11.111.111-1',
        estado: 'BORRADOR' as const,
      };
      await service.create(dto, 'uid-admin', 'Admin');

      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({ accion: 'CREAR_DOCUMENTO', coleccion: 'documentos' });
    });

    it('debe permitir crear directamente en estado SELLADO si se especifica', async () => {
      const docRef = createMockDocumentRef('doc-sellado');
      setupCollection(docRef);
      setupBatch();

      const dto = {
        titulo: 'Doc Sellado',
        descripcion: 'Desc',
        monto: 5000,
        fecha_emision: new Date(),
        rut_emisor: '22.222.222-2',
        estado: 'SELLADO' as const,
      };

      const result = await service.create(dto, 'uid-admin', 'Admin');
      expect(result.estado).toBe('SELLADO');
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('debe retornar todos los documentos ordenados por fecha_creacion desc', async () => {
      const data = makeDocumento();
      const querySnap = createQuerySnapshot([{ id: 'd1', data }]);
      const fakeQuery = {
        get: jest.fn().mockResolvedValue(querySnap),
      };
      const collection = {
        orderBy: jest.fn().mockReturnValue(fakeQuery),
      };
      mockFirestore.collection.mockReturnValue(collection as any);

      const results = await service.findAll();

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('d1');
      expect(collection.orderBy).toHaveBeenCalledWith('fecha_creacion', 'desc');
    });

    it('debe filtrar por estado cuando se provee', async () => {
      const data = makeDocumento({ estado: 'BORRADOR' });
      const querySnap = createQuerySnapshot([{ id: 'd2', data }]);
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

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('debe retornar el documento si existe', async () => {
      const docRef = createMockDocumentRef('doc-find');
      const snap = createMockDocSnapshot('doc-find', makeDocumento());
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      const result = await service.findOne('doc-find');

      expect(result.id).toBe('doc-find');
      expect(result.titulo).toBe('Balance Anual 2026');
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      const docRef = createMockDocumentRef('doc-missing');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      const collection = { doc: jest.fn().mockReturnValue(docRef) };
      mockFirestore.collection.mockReturnValue(collection as any);

      await expect(service.findOne('doc-missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByVerificationUuid ────────────────────────────────────────────────

  describe('findByVerificationUuid', () => {
    it('debe retornar datos del documento para un UUID valido', async () => {
      const data = makeDocumento({
        estado: 'SELLADO',
        hash_integridad: 'abc123',
        uuid_verificacion: '550e8400-e29b-41d4-a716-446655440000',
        fecha_sellado: new Date(),
      });
      const querySnap = createQuerySnapshot([{ id: 'doc-verify', data }]);
      const limitQuery = { get: jest.fn().mockResolvedValue(querySnap) };
      const whereQuery = { limit: jest.fn().mockReturnValue(limitQuery) };
      const collection = {
        where: jest.fn().mockReturnValue(whereQuery),
      };
      mockFirestore.collection.mockReturnValue(collection as any);

      const result = await service.findByVerificationUuid('550e8400-e29b-41d4-a716-446655440000');

      expect(result.valido).toBe(true);
      expect(result.titulo).toBe('Balance Anual 2026');
      expect(result.monto).toBe(1500000);
    });

    it('debe retornar valido: false para UUID inexistente', async () => {
      const querySnap = createQuerySnapshot([]);
      const limitQuery = { get: jest.fn().mockResolvedValue(querySnap) };
      const whereQuery = { limit: jest.fn().mockReturnValue(limitQuery) };
      const collection = {
        where: jest.fn().mockReturnValue(whereQuery),
      };
      mockFirestore.collection.mockReturnValue(collection as any);

      const result = await service.findByVerificationUuid('uuid-inexistente');

      expect(result.valido).toBe(false);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('debe actualizar campos de un documento BORRADOR', async () => {
      const docRef = createMockDocumentRef('doc-upd');
      const snap = createMockDocSnapshot('doc-upd', makeDocumento());
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.update(
        'doc-upd',
        { titulo: 'Actualizado' },
        'uid-admin',
        'Admin',
      );

      expect(batch.update).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({ titulo: 'Actualizado' }),
      );
      expect(result.fecha_actualizacion).toBeDefined();
    });

    it('debe registrar auditoria con payload_anterior al actualizar', async () => {
      const docRef = createMockDocumentRef('doc-aud-upd');
      const snap = createMockDocSnapshot('doc-aud-upd', makeDocumento());
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);
      setupBatch();

      await service.update('doc-aud-upd', { descripcion: 'Nueva desc' }, 'uid', 'Admin');

      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({
        accion: 'ACTUALIZAR_DOCUMENTO',
        coleccion: 'documentos',
        documento_id: 'doc-aud-upd',
      });
      expect(entry.payload_anterior).toBeDefined();
    });

    it('debe lanzar BadRequestException si el documento ya fue sellado', async () => {
      const docRef = createMockDocumentRef('doc-sealed');
      const snap = createMockDocSnapshot('doc-sealed', makeDocumento({ estado: 'SELLADO' }));
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      await expect(
        service.update('doc-sealed', { titulo: 'Nuevo' }, 'uid', 'Admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      const docRef = createMockDocumentRef('doc-nx');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      const collection = { doc: jest.fn().mockReturnValue(docRef) };
      mockFirestore.collection.mockReturnValue(collection as any);

      await expect(
        service.update('doc-nx', { titulo: 'Nuevo' }, 'uid', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── sellar ────────────────────────────────────────────────────────────────

  describe('sellar', () => {
    beforeEach(() => {
      process.env.DOCUMENT_SALT = 'test-salt-secreto';
      process.env.VERIFICATION_BASE_URL = 'https://test.example.com';
    });

    it('debe sellar un documento BORRADOR con hash, QR y UUID', async () => {
      const docRef = createMockDocumentRef('doc-to-seal');
      const snap = createMockDocSnapshot('doc-to-seal', makeDocumento({ estado: 'BORRADOR' }));
      const t = setupTransaction();
      t.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      const result = await service.sellar('doc-to-seal', 'uid-admin', 'Admin');

      expect(mockIntegrityService.computeHash).toHaveBeenCalledWith(
        'doc-to-seal',
        expect.any(String),
        1500000,
        '12.345.678-9',
        'test-salt-secreto',
      );
      expect(mockIntegrityService.generateQR).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/test\.example\.com\/validar\//),
      );
      expect(t.update).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({
          estado: 'SELLADO',
          hash_integridad: expect.any(String),
          uuid_verificacion: expect.any(String),
          qr_base64: 'data:image/png;base64,mockQR',
        }),
      );
      expect(result.estado).toBe('SELLADO');
    });

    it('debe usar URL por defecto si VERIFICATION_BASE_URL no esta configurada', async () => {
      delete process.env.VERIFICATION_BASE_URL;
      const docRef = createMockDocumentRef('doc-default-url');
      const snap = createMockDocSnapshot('doc-default-url', makeDocumento({ estado: 'BORRADOR' }));
      const t = setupTransaction();
      t.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      await service.sellar('doc-default-url', 'uid-admin', 'Admin');

      expect(mockIntegrityService.generateQR).toHaveBeenCalledWith(
        expect.stringContaining('cgpa-liceo-agb.web.app'),
      );
    });

    it('debe lanzar BadRequestException si el documento ya fue sellado', async () => {
      const docRef = createMockDocumentRef('doc-already');
      const snap = createMockDocSnapshot('doc-already', makeDocumento({ estado: 'SELLADO' }));
      const t = setupTransaction();
      t.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      await expect(
        service.sellar('doc-already', 'uid-admin', 'Admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      const docRef = createMockDocumentRef('doc-missing-seal');
      const missingSnap = createMissingDocSnapshot();
      const t = setupTransaction();
      t.get.mockResolvedValue(missingSnap as any);
      setupCollection(docRef);

      await expect(
        service.sellar('doc-missing-seal', 'uid-admin', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar InternalServerErrorException si DOCUMENT_SALT no esta configurado', async () => {
      delete process.env.DOCUMENT_SALT;
      const docRef = createMockDocumentRef('doc-no-salt');
      const snap = createMockDocSnapshot('doc-no-salt', makeDocumento({ estado: 'BORRADOR' }));
      const t = setupTransaction();
      t.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      await expect(
        service.sellar('doc-no-salt', 'uid-admin', 'Admin'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ─── generatePdf ───────────────────────────────────────────────────────────

  describe('generatePdf', () => {
    it('debe retornar Buffer para documento SELLADO', async () => {
      const docRef = createMockDocumentRef('doc-pdf');
      const snap = createMockDocSnapshot('doc-pdf', makeDocumento({
        estado: 'SELLADO',
        hash_integridad: 'abc12345def67890',
        qr_base64: 'data:image/png;base64,qrFake',
      }));
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      const result = await service.generatePdf('doc-pdf');

      expect(result).toBeInstanceOf(Buffer);
      expect(mockIntegrityService.generatePDFBuffer).toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException para documento BORRADOR', async () => {
      const docRef = createMockDocumentRef('doc-borrador');
      const snap = createMockDocSnapshot('doc-borrador', makeDocumento({ estado: 'BORRADOR' }));
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);

      await expect(service.generatePdf('doc-borrador')).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      const docRef = createMockDocumentRef('doc-missing-pdf');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      const collection = { doc: jest.fn().mockReturnValue(docRef) };
      mockFirestore.collection.mockReturnValue(collection as any);

      await expect(service.generatePdf('doc-missing-pdf')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('debe eliminar el documento y registrar auditoria', async () => {
      const docRef = createMockDocumentRef('doc-del');
      const snap = createMockDocSnapshot('doc-del', makeDocumento());
      docRef.get.mockResolvedValue(snap as any);
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.remove('doc-del', 'uid-admin', 'Admin');

      expect(result).toEqual({ message: 'Documento eliminado correctamente' });
      expect(batch.delete).toHaveBeenCalledWith(docRef);
      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledTimes(1);
      const [, entry] = (mockAuditService.logActionWithTransactionOrBatch as jest.Mock).mock.calls[0];
      expect(entry).toMatchObject({ accion: 'ELIMINAR_DOCUMENTO' });
    });

    it('no debe fallar si el documento ya no existe', async () => {
      const docRef = createMockDocumentRef('doc-inexistente');
      const missingSnap = createMissingDocSnapshot();
      docRef.get.mockResolvedValue(missingSnap as any);
      setupCollection(docRef);
      const batch = setupBatch();

      const result = await service.remove('doc-inexistente', 'uid-admin', 'Admin');

      expect(result).toEqual({ message: 'Documento eliminado correctamente' });
      expect(batch.delete).toHaveBeenCalledWith(docRef);
    });
  });

  // ─── hash determinism ──────────────────────────────────────────────────────

  describe('computeHash', () => {
    it('debe producir el mismo hash para los mismos datos y salt', () => {
      const hash1 = mockIntegrityService.computeHash('id1', '2026-03-15T00:00:00.000Z', 1500000, '12.345.678-9', 'salt');
      const hash2 = mockIntegrityService.computeHash('id1', '2026-03-15T00:00:00.000Z', 1500000, '12.345.678-9', 'salt');
      expect(hash1).toBe(hash2);
    });
  });
});
