import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  let mockAuth: {
    setCustomUserClaims: jest.Mock;
    revokeRefreshTokens: jest.Mock;
    [k: string]: any;
  };
  let mockAuditService: jest.Mocked<AuditService>;

  const originalRegistrationFlag = process.env.REGISTRO_HABILITADO;

  beforeEach(async () => {
    process.env.REGISTRO_HABILITADO = 'true';
    mockFirestore = createMockFirestore();
    (admin.firestore as any).FieldValue = {
      serverTimestamp: jest.fn(() => 'SERVER_TS'),
    };
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

    mockAuth = {
      setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
      revokeRefreshTokens: jest.fn().mockResolvedValue(undefined),
    };
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

  afterEach(() => {
    jest.clearAllMocks();
    if (originalRegistrationFlag === undefined) {
      delete process.env.REGISTRO_HABILITADO;
    } else {
      process.env.REGISTRO_HABILITADO = originalRegistrationFlag;
    }
  });

  // ─── registerUser ──────────────────────────────────────────────────────────

  describe('registerUser', () => {
    it('debe rechazar el registro con 403 cuando el flag está cerrado', async () => {
      process.env.REGISTRO_HABILITADO = 'false';

      await expect(
        service.registerUser('uid-cerrado', 'cerrado@test.cl', 'Cerrado'),
      ).rejects.toThrow(ForbiddenException);

      // No debe tocar Firestore ni Firebase Auth.
      expect(mockFirestore.collection).not.toHaveBeenCalled();
      expect(mockAuth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('debe crear el usuario con activo: false y rol PENDIENTE', async () => {
      const missingSnap = createMissingDocSnapshot();
      const docRef = createMockDocumentRef('new-uid');
      docRef.get.mockResolvedValue(missingSnap);
      docRef.set.mockResolvedValue(undefined as any);

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      const result = await service.registerUser(
        'new-uid',
        'nuevo@test.cl',
        'Nuevo',
      );

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
      docRef.get.mockResolvedValue(missingSnap);
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
      const existingSnap = createMockDocSnapshot('uid-exist', {
        uid: 'uid-exist',
      });
      const docRef = createMockDocumentRef('uid-exist');
      docRef.get.mockResolvedValue(existingSnap);

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
      docRef.get.mockResolvedValue(existingSnap);

      const batch = createMockWriteBatch();
      mockFirestore.batch.mockReturnValue(batch);
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      const result = await service.approveUser(
        'uid-pend',
        'EDITOR',
        'uid-admin',
        'Admin',
      );

      expect(result).toMatchObject({ targetUid: 'uid-pend', role: 'EDITOR' });
      expect(batch.update).toHaveBeenCalledWith(
        docRef,
        expect.objectContaining({ activo: true, rol: 'EDITOR' }),
      );
      expect(
        mockAuditService.logActionWithTransactionOrBatch,
      ).toHaveBeenCalledWith(
        batch,
        expect.objectContaining({
          accion: 'APROBAR_USUARIO',
          coleccion: 'usuarios',
        }),
      );
    });

    it('debe revocar los tokens vigentes al aprobar o cambiar el rol', async () => {
      const existingSnap = createMockDocSnapshot('uid-aprob', {
        uid: 'uid-aprob',
        activo: false,
      });
      const docRef = createMockDocumentRef('uid-aprob');
      docRef.get.mockResolvedValue(existingSnap);

      const batch = createMockWriteBatch();
      mockFirestore.batch.mockReturnValue(batch);
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      await service.approveUser('uid-aprob', 'ADMIN', 'uid-super', 'Super');

      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('uid-aprob', {
        role: 'ADMIN',
        activo: true,
      });
      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith('uid-aprob');
    });

    it('debe lanzar NotFoundException si el usuario a aprobar no existe', async () => {
      const missingSnap = createMissingDocSnapshot();
      const docRef = createMockDocumentRef('uid-nx');
      docRef.get.mockResolvedValue(missingSnap);

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      await expect(
        service.approveUser('uid-nx', 'EDITOR', 'uid-admin', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateUserRole ────────────────────────────────────────────────────────

  describe('updateUserRole', () => {
    function setupUser(data: Record<string, any>) {
      const docRef = createMockDocumentRef('uid-rol');
      docRef.get.mockResolvedValue(createMockDocSnapshot('uid-rol', data));
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);
      mockFirestore.batch.mockReturnValue(createMockWriteBatch());
      return docRef;
    }

    it('debe actualizar el rol y revocar los tokens vigentes', async () => {
      setupUser({ uid: 'uid-rol', rol: 'APODERADO', activo: true });

      const result = await service.updateUserRole(
        'uid-rol',
        'TESORERO',
        'uid-admin',
        'Admin',
      );

      expect(result).toMatchObject({ targetUid: 'uid-rol', role: 'TESORERO' });
      expect(mockAuth.setCustomUserClaims).toHaveBeenCalledWith('uid-rol', {
        role: 'TESORERO',
        activo: true,
      });
      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith('uid-rol');
    });

    it('debe lanzar NotFoundException si el usuario no existe', async () => {
      const docRef = createMockDocumentRef('uid-nx');
      docRef.get.mockResolvedValue(createMissingDocSnapshot());
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);

      await expect(
        service.updateUserRole('uid-nx', 'ADMIN', 'uid-admin', 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── deactivateUser ────────────────────────────────────────────────────────

  describe('deactivateUser', () => {
    function setupUser(activo: boolean) {
      const docRef = createMockDocumentRef('uid-estado');
      docRef.get.mockResolvedValue(
        createMockDocSnapshot('uid-estado', {
          uid: 'uid-estado',
          rol: 'APODERADO',
          activo,
        }),
      );
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);
      mockFirestore.batch.mockReturnValue(createMockWriteBatch());
      return docRef;
    }

    it('debe revocar los tokens al desactivar una cuenta', async () => {
      setupUser(true);

      const result = await service.deactivateUser(
        'uid-estado',
        'uid-admin',
        'Admin',
      );

      expect(result).toMatchObject({ activo: false });
      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith('uid-estado');
    });

    it('no debe revocar tokens al reactivar una cuenta', async () => {
      setupUser(false);

      const result = await service.deactivateUser(
        'uid-estado',
        'uid-admin',
        'Admin',
      );

      expect(result).toMatchObject({ activo: true });
      expect(mockAuth.revokeRefreshTokens).not.toHaveBeenCalled();
    });
  });

  // ─── deleteUser ────────────────────────────────────────────────────────────

  describe('deleteUser', () => {
    it('debe revocar los tokens antes de eliminar la cuenta', async () => {
      const docRef = createMockDocumentRef('uid-del');
      docRef.get.mockResolvedValue(
        createMockDocSnapshot('uid-del', {
          uid: 'uid-del',
          rol: 'APODERADO',
          activo: true,
        }),
      );
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue(docRef),
      } as any);
      mockAuth.deleteUser = jest.fn().mockResolvedValue(undefined);

      const result = await service.deleteUser('uid-del', 'uid-admin', 'Admin');

      expect(result).toMatchObject({ targetUid: 'uid-del' });
      expect(docRef.delete).toHaveBeenCalled();
      expect(mockAuth.revokeRefreshTokens).toHaveBeenCalledWith('uid-del');
      expect(mockAuth.deleteUser).toHaveBeenCalledWith('uid-del');
    });
  });
});
