/**
 * @file usuarios.e2e-spec.ts
 * @description Tests de integración para los endpoints de /usuarios.
 * Verifica autenticación, autorización por rol y manejo de errores.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { UsuariosService } from '../src/usuarios/usuarios.service';

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  auth: jest.fn(),
  storage: jest.fn(),
  apps: [],
}));

import * as admin from 'firebase-admin';

// ─── Usuarios de prueba ────────────────────────────────────────────────────────

const MOCK_ADMIN = { uid: 'uid-admin', email: 'admin@cgpa.cl', name: 'Admin', role: 'ADMIN', activo: true };
const MOCK_EDITOR = { uid: 'uid-editor', email: 'editor@cgpa.cl', name: 'Editor', role: 'EDITOR', activo: true };
const MOCK_NEW_USER = { uid: 'uid-new', email: 'nuevo@cgpa.cl', name: 'Nuevo', role: undefined, activo: undefined };

describe('UsuariosController (e2e)', () => {
  let app: INestApplication;
  let mockUsuariosService: jest.Mocked<Partial<UsuariosService>>;
  let mockAuth: { verifyIdToken: jest.Mock };

  beforeAll(async () => {
    mockAuth = { verifyIdToken: jest.fn().mockResolvedValue(MOCK_ADMIN) };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);
    (admin.firestore as jest.Mock).mockReturnValue({ collection: jest.fn() });

    mockUsuariosService = {
      registerUser: jest.fn().mockResolvedValue({
        message: 'Usuario registrado correctamente. Pendiente de aprobación.',
        data: { uid: MOCK_NEW_USER.uid, activo: false, rol: 'PENDIENTE' },
      }),
      getPendingUsers: jest.fn().mockResolvedValue([
        { id: 'uid-p1', uid: 'uid-p1', activo: false, rol: 'PENDIENTE' },
      ]),
      approveUser: jest.fn().mockResolvedValue({
        message: 'Usuario aprobado exitosamente',
        targetUid: 'uid-p1',
        role: 'EDITOR',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(UsuariosService)
      .useValue(mockUsuariosService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());
  afterEach(() => jest.clearAllMocks());

  // ─── POST /usuarios/registro ───────────────────────────────────────────────

  describe('POST /usuarios/registro', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).post('/usuarios/registro').expect(401);
    });

    it('debe registrar al usuario autenticado y retornar 201', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_NEW_USER);

      const { body } = await request(app.getHttpServer())
        .post('/usuarios/registro')
        .set('Authorization', 'Bearer new-user-token')
        .expect(201);

      expect(body.message).toContain('Pendiente de aprobación');
      expect(mockUsuariosService.registerUser).toHaveBeenCalledWith(
        MOCK_NEW_USER.uid,
        MOCK_NEW_USER.email,
        MOCK_NEW_USER.name,
      );
    });

    it('debe retornar 400 si el usuario ya está registrado', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_NEW_USER);
      (mockUsuariosService.registerUser as jest.Mock).mockRejectedValue(
        new BadRequestException('El usuario ya está registrado en la base de datos'),
      );

      await request(app.getHttpServer())
        .post('/usuarios/registro')
        .set('Authorization', 'Bearer existing-user-token')
        .expect(400);
    });
  });

  // ─── GET /usuarios/pendientes ──────────────────────────────────────────────

  describe('GET /usuarios/pendientes', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).get('/usuarios/pendientes').expect(401);
    });

    it('debe retornar 403 si el usuario no es ADMIN', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_EDITOR); // role: EDITOR

      await request(app.getHttpServer())
        .get('/usuarios/pendientes')
        .set('Authorization', 'Bearer editor-token')
        .expect(403);
    });

    it('debe retornar 200 con lista de pendientes si el usuario es ADMIN', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN);

      const { body } = await request(app.getHttpServer())
        .get('/usuarios/pendientes')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toHaveProperty('activo', false);
    });
  });

  // ─── PATCH /usuarios/:uid/aprobar ─────────────────────────────────────────

  describe('PATCH /usuarios/:uid/aprobar', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer())
        .patch('/usuarios/uid-p1/aprobar')
        .send({ rol: 'EDITOR' })
        .expect(401);
    });

    it('debe retornar 403 si el usuario no es ADMIN', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_EDITOR);

      await request(app.getHttpServer())
        .patch('/usuarios/uid-p1/aprobar')
        .set('Authorization', 'Bearer editor-token')
        .send({ rol: 'EDITOR' })
        .expect(403);
    });

    it('debe retornar 403 si no se proporciona rol en el body', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN);

      await request(app.getHttpServer())
        .patch('/usuarios/uid-p1/aprobar')
        .set('Authorization', 'Bearer admin-token')
        .send({}) // sin campo rol
        .expect(403);
    });

    it('debe retornar 404 si el usuario a aprobar no existe', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN);
      (mockUsuariosService.approveUser as jest.Mock).mockRejectedValue(
        new NotFoundException('Usuario uid-nx no encontrado'),
      );

      await request(app.getHttpServer())
        .patch('/usuarios/uid-nx/aprobar')
        .set('Authorization', 'Bearer admin-token')
        .send({ rol: 'EDITOR' })
        .expect(404);
    });

    it('debe retornar 200 al aprobar correctamente con rol válido', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN);
      (mockUsuariosService.approveUser as jest.Mock).mockResolvedValue({
        message: 'Usuario aprobado exitosamente',
        targetUid: 'uid-p1',
        role: 'EDITOR',
      });

      const { body } = await request(app.getHttpServer())
        .patch('/usuarios/uid-p1/aprobar')
        .set('Authorization', 'Bearer admin-token')
        .send({ rol: 'EDITOR' })
        .expect(200);

      expect(body.message).toContain('aprobado');
      expect(body.role).toBe('EDITOR');
    });
  });
});
