/**
 * @file comunicados.e2e-spec.ts
 * @description Tests de integracion para los endpoints de /comunicados.
 * Cubre endpoint publico, autenticacion, validacion, CRUD y manejo de errores.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { ComunicadosService } from '../src/comunicados/comunicados.service';

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  auth: jest.fn(),
  storage: jest.fn(),
  apps: [],
}));

import * as admin from 'firebase-admin';

const MOCK_ADMIN_USER = {
  uid: 'uid-admin-e2e',
  email: 'admin@test.cl',
  name: 'Admin E2E',
  role: 'ADMIN',
  activo: true,
};

const MOCK_COMUNICADO = {
  id: 'com-e2e-001',
  titulo: 'Comunicado E2E',
  contenido: '# Titulo\n\nContenido del comunicado',
  estado: 'PUBLICADO',
  fecha_publicacion: new Date(),
  fecha_creacion: new Date(),
  creado_por: { uid: 'uid-admin-e2e', nombre: 'Admin E2E' },
};

describe('ComunicadosController (e2e)', () => {
  let app: INestApplication;
  let mockComunicadosService: jest.Mocked<Partial<ComunicadosService>>;

  beforeAll(async () => {
    const mockAuth = { verifyIdToken: jest.fn().mockResolvedValue(MOCK_ADMIN_USER) };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);
    (admin.firestore as jest.Mock).mockReturnValue({ collection: jest.fn() });
    (admin.storage as jest.Mock).mockReturnValue({ bucket: jest.fn() });

    mockComunicadosService = {
      findAllPublic: jest.fn().mockResolvedValue([MOCK_COMUNICADO]),
      findAll: jest.fn().mockResolvedValue([MOCK_COMUNICADO]),
      findOne: jest.fn().mockResolvedValue(MOCK_COMUNICADO),
      create: jest.fn().mockResolvedValue(MOCK_COMUNICADO),
      update: jest.fn().mockResolvedValue({ id: 'com-e2e-001', titulo: 'Actualizado' }),
      remove: jest.fn().mockResolvedValue({ message: 'Comunicado eliminado correctamente' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(ComunicadosService)
      .useValue(mockComunicadosService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());
  afterEach(() => jest.clearAllMocks());

  // ─── GET /comunicados/publicos ──────────────────────────────────────────────

  describe('GET /comunicados/publicos', () => {
    it('debe retornar 200 sin token (endpoint publico)', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/comunicados/publicos')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toHaveProperty('id', 'com-e2e-001');
    });

    it('debe llamar a findAllPublic del servicio', async () => {
      await request(app.getHttpServer()).get('/comunicados/publicos').expect(200);
      expect(mockComunicadosService.findAllPublic).toHaveBeenCalledTimes(1);
    });
  });

  // ─── GET /comunicados ───────────────────────────────────────────────────────

  describe('GET /comunicados', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).get('/comunicados').expect(401);
    });

    it('debe retornar 200 con token valido', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/comunicados')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
    });

    it('debe pasar filtro estado al servicio', async () => {
      await request(app.getHttpServer())
        .get('/comunicados?estado=BORRADOR')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(mockComunicadosService.findAll).toHaveBeenCalledWith('BORRADOR');
    });
  });

  // ─── GET /comunicados/:id ───────────────────────────────────────────────────

  describe('GET /comunicados/:id', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).get('/comunicados/com-e2e-001').expect(401);
    });

    it('debe retornar 404 si no existe', async () => {
      (mockComunicadosService.findOne as jest.Mock).mockRejectedValue(
        new NotFoundException('Comunicado no encontrado'),
      );

      await request(app.getHttpServer())
        .get('/comunicados/id-inexistente')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
    });

    it('debe retornar 200 con el comunicado', async () => {
      (mockComunicadosService.findOne as jest.Mock).mockResolvedValue(MOCK_COMUNICADO);

      const { body } = await request(app.getHttpServer())
        .get('/comunicados/com-e2e-001')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(body.id).toBe('com-e2e-001');
    });
  });

  // ─── POST /comunicados ──────────────────────────────────────────────────────

  describe('POST /comunicados', () => {
    const validBody = {
      titulo: 'Nuevo Comunicado',
      contenido: '# Hola\n\nContenido markdown',
      estado: 'PUBLICADO',
      fecha_publicacion: '2026-05-04T12:00:00.000Z',
    };

    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).post('/comunicados').send(validBody).expect(401);
    });

    it('debe retornar 400 si falta titulo', async () => {
      const { titulo: _, ...bodyWithoutTitulo } = validBody;
      await request(app.getHttpServer())
        .post('/comunicados')
        .set('Authorization', 'Bearer valid-token')
        .send(bodyWithoutTitulo)
        .expect(400);
    });

    it('debe retornar 400 si falta contenido', async () => {
      const { contenido: _, ...bodyWithoutContenido } = validBody;
      await request(app.getHttpServer())
        .post('/comunicados')
        .set('Authorization', 'Bearer valid-token')
        .send(bodyWithoutContenido)
        .expect(400);
    });

    it('debe retornar 400 si estado es invalido', async () => {
      await request(app.getHttpServer())
        .post('/comunicados')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validBody, estado: 'INVALIDO' })
        .expect(400);
    });

    it('debe retornar 201 en happy path', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/comunicados')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody)
        .expect(201);

      expect(body).toHaveProperty('id');
      expect(mockComunicadosService.create).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: 'Nuevo Comunicado' }),
        MOCK_ADMIN_USER.uid,
        MOCK_ADMIN_USER.name,
      );
    });
  });

  // ─── PATCH /comunicados/:id ─────────────────────────────────────────────────

  describe('PATCH /comunicados/:id', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer())
        .patch('/comunicados/com-e2e-001')
        .send({ titulo: 'Nuevo titulo' })
        .expect(401);
    });

    it('debe retornar 400 si titulo esta vacio', async () => {
      await request(app.getHttpServer())
        .patch('/comunicados/com-e2e-001')
        .set('Authorization', 'Bearer valid-token')
        .send({ titulo: '' })
        .expect(400);
    });

    it('debe retornar 200 al actualizar correctamente', async () => {
      const { body } = await request(app.getHttpServer())
        .patch('/comunicados/com-e2e-001')
        .set('Authorization', 'Bearer valid-token')
        .send({ titulo: 'Titulo Actualizado' })
        .expect(200);

      expect(body).toHaveProperty('id', 'com-e2e-001');
    });
  });

  // ─── DELETE /comunicados/:id ────────────────────────────────────────────────

  describe('DELETE /comunicados/:id', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).delete('/comunicados/com-e2e-001').expect(401);
    });

    it('debe retornar 200 al eliminar correctamente', async () => {
      const { body } = await request(app.getHttpServer())
        .delete('/comunicados/com-e2e-001')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(body.message).toContain('eliminado');
    });
  });

  // ─── POST /comunicados/imagenes ─────────────────────────────────────────────

  describe('POST /comunicados/imagenes', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer())
        .post('/comunicados/imagenes')
        .attach('file', Buffer.from('test'), 'test.png')
        .expect(401);
    });

    it('debe retornar 400 si no se envia archivo', async () => {
      await request(app.getHttpServer())
        .post('/comunicados/imagenes')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });
  });
});
