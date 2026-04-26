import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
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
  auth: jest.fn(),
}));

import * as admin from 'firebase-admin';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let mockAuth: { setCustomUserClaims: jest.Mock; [k: string]: any };
  let mockAuditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    mockFirestore = createMockFirestore();
    (admin.firestore as any).FieldValue = {
      serverTimestamp: jest.fn(() => 'SERVER_TS'),
    };
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

    mockAuth = { setCustomUserClaims: jest.fn().mockResolvedValue(undefined) };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);

    mockAuditService = {
      logAction: jest.fn(),
      logActionWithTransactionOrBatch: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── registerUser ──────────────────────────────────────────────────────────

  describe('registerUser', () => {
    it('debe crear el usuario con activo: false y rol PENDIENTE', async () => {
      const missingSnap = createMissingDocSnapshot();
      const docRef = createMockDocumentRef('new-uid');
      docRef.get.mockResolvedValue(missingSnap as any);
      docRef.set.mockResolvedValue(undefined as any);

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      const result = await service.registerUser('new-uid', 'nuevo@test.cl', 'Nuevo');

      expect(result.message).toContain('Pendiente de aprobación');
      expect(result.data).toMatchObject({
        uid: 'new-uid',
        email: 'nuevo@test.cl',
        activo: false,
        rol: 'PENDIENTE',
      });
      expect(docRef.set).toHaveBeenCalledWith(
        expect.objectContaining({ activo: false, rol: 'PENDIENTE' }),
      );
    });

    it('debe llamar a setCustomUserClaims con role PENDIENTE y activo false', async () => {
      const missingSnap = createMissingDocSnapshot();
      const docRef = createMockDocumentRef('new-uid-2');
      docRef.get.mockResolvedValue(missingSnap as any);
      docRef.set.mockResolvedValue(undefined as any);

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      await service.registerUser('new-uid-2', 'otro@test.cl', 'Otro');

      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('new-uid-2', {
        role: 'PENDIENTE',
        activo: false,
      });
    });

    it('debe lanzar BadRequestException si el usuario ya existe en Firestore', async () => {
      const existingSnap = createMockDocSnapshot('uid-exist', { uid: 'uid-exist' });
      const docRef = createMockDocumentRef('uid-exist');
      docRef.get.mockResolvedValue(existingSnap as any);

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      await expect(
        service.registerUser('uid-exist', 'ya@registrado.cl', 'Ya Registrado'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── getPendingUsers ───────────────────────────────────────────────────────

  describe('getPendingUsers', () => {
    it('debe retornar usuarios con activo == false', async () => {
      const querySnap = createQuerySnapshot([
        { id: 'u1', data: { uid: 'u1', activo: false, rol: 'PENDIENTE' } },
        { id: 'u2', data: { uid: 'u2', activo: false, rol: 'PENDIENTE' } },
      ]);

      const collection = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(querySnap),
      };
      mockFirestore.collection.mockReturnValue(collection as any);

      const result = await service.getPendingUsers();

      expect(collection.where).toHaveBeenCalledWith('activo', '==', false);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 'u1', activo: false });
    });

    it('debe retornar array vacío si no hay usuarios pendientes', async () => {
      const emptySnap = createQuerySnapshot([]);
      const collection = {
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(emptySnap),
      };
      mockFirestore.collection.mockReturnValue(collection as any);

      const result = await service.getPendingUsers();
      expect(result).toEqual([]);
    });
  });

  // ─── approveUser ───────────────────────────────────────────────────────────

  describe('approveUser', () => {
    it('debe actualizar activo: true, asignar rol y llamar audit', async () => {
      const existingSnap = createMockDocSnapshot('uid-pend', {
        uid: 'uid-pend',
        activo: false,
        rol: 'PENDIENTE',
      });
      const docRef = createMockDocumentRef('uid-pend');
      docRef.get.mockResolvedValue(existingSnap as any);

      const batch = createMockWriteBatch();
      mockFirestore.batch.mockReturnValue(batch as any);
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      const result = await service.approveUser('uid-pend', 'EDITOR', 'uid-admin', 'Admin');

      expect(result).toMatchObject({ targetUid: 'uid-pend', role: 'EDITOR' });
      expect(batch.update).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({ activo: true, rol: 'EDITOR' }),
      );
      expect(mockAuditService.logActionWithTransactionOrBatch).toHaveBeenCalledWith(
        batch,
        expect.objectContaining({ accion: 'APROBAR_USUARIO', coleccion: 'usuarios' }),
      );
    });

    it('debe llamar a setCustomUserClaims con el nuevo rol al aprobar', async () => {
      const existingSnap = createMockDocSnapshot('uid-aprob', {
        uid: 'uid-aprob',
        activo: false,
      });
      const docRef = createMockDocumentRef('uid-aprob');
      docRef.get.mockResolvedValue(existingSnap as any);

      const batch = createMockWriteBatch();
      mockFirestore.batch.mockReturnValue(batch as any);
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      await service.approveUser('uid-aprob', 'ADMIN', 'uid-super', 'Super');

      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('uid-aprob', {
        role: 'ADMIN',
        activo: true,
      });
    });

    it('debe lanzar NotFoundException si el usuario a aprobar no existe', async () => {
      const missingSnap = createMissingDocSnapshot();
      const docRef = createMockDocumentRef('uid-nx');
      docRef.get.mockResolvedValue(missingSnap as any);

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      await expect(
        service.approveUser('uid-nx', 'EDITOR', 'uid-admin', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
