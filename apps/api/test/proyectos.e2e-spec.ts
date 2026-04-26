/**
 * @file proyectos.e2e-spec.ts
 * @description Tests de integración para los endpoints de /proyectos.
 * Cubre autenticación, validación de body, CRUD y manejo de errores.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { ProyectosService } from '../src/proyectos/proyectos.service';

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

const MOCK_PROYECTO = {
  id: 'proj-e2e-001',
  nombre: 'Proyecto E2E',
  descripcion: 'Descripción',
  estado: 'PLANIFICACION',
  presupuesto_estimado: 100000,
  monto_recaudado: 0,
  monto_ejecutado: 0,
  avance_financiero: 0,
};

describe('ProyectosController (e2e)', () => {
  let app: INestApplication;
  let mockProyectosService: jest.Mocked<Partial<ProyectosService>>;

  beforeAll(async () => {
    const mockAuth = { verifyIdToken: jest.fn().mockResolvedValue(MOCK_ADMIN_USER) };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);
    (admin.firestore as jest.Mock).mockReturnValue({ collection: jest.fn() });

    mockProyectosService = {
      create: jest.fn().mockResolvedValue(MOCK_PROYECTO),
      findAll: jest.fn().mockResolvedValue([MOCK_PROYECTO]),
      findOne: jest.fn().mockResolvedValue(MOCK_PROYECTO),
      update: jest.fn().mockResolvedValue({ id: 'proj-e2e-001', nombre: 'Actualizado' }),
      remove: jest.fn().mockResolvedValue({ message: 'Proyecto eliminado correctamente' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(ProyectosService)
      .useValue(mockProyectosService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());
  afterEach(() => jest.clearAllMocks());

  // ─── GET /proyectos ────────────────────────────────────────────────────────

  describe('GET /proyectos', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).get('/proyectos').expect(401);
    });

    it('debe retornar 200 con lista de proyectos', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/proyectos')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toHaveProperty('id', 'proj-e2e-001');
    });
  });

  // ─── GET /proyectos/:id ────────────────────────────────────────────────────

  describe('GET /proyectos/:id', () => {
    it('debe retornar 404 si el proyecto no existe', async () => {
      (mockProyectosService.findOne as jest.Mock).mockRejectedValue(
        new NotFoundException('Proyecto no encontrado'),
      );

      await request(app.getHttpServer())
        .get('/proyectos/id-inexistente')
        .set('Authorization', 'Bearer valid-token')
        .expect(404);
    });

    it('debe retornar 200 con el proyecto si existe', async () => {
      (mockProyectosService.findOne as jest.Mock).mockResolvedValue(MOCK_PROYECTO);

      const { body } = await request(app.getHttpServer())
        .get('/proyectos/proj-e2e-001')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(body.id).toBe('proj-e2e-001');
    });
  });

  // ─── POST /proyectos ───────────────────────────────────────────────────────

  describe('POST /proyectos', () => {
    const validBody = {
      nombre: 'Nuevo Proyecto',
      descripcion: 'Descripción válida',
      presupuesto_estimado: 50000,
      responsable: { uid: 'uid-r', nombre: 'Responsable' },
    };

    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).post('/proyectos').send(validBody).expect(401);
    });

    it('debe retornar 400 si falta el campo nombre', async () => {
      const { nombre: _, ...bodyWithoutNombre } = validBody;
      await request(app.getHttpServer())
        .post('/proyectos')
        .set('Authorization', 'Bearer valid-token')
        .send(bodyWithoutNombre)
        .expect(400);
    });

    it('debe retornar 400 si presupuesto_estimado es negativo', async () => {
      await request(app.getHttpServer())
        .post('/proyectos')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validBody, presupuesto_estimado: -1000 })
        .expect(400);
    });

    it('debe retornar 201 con el proyecto creado en happy path', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/proyectos')
        .set('Authorization', 'Bearer valid-token')
        .send(validBody)
        .expect(201);

      expect(body).toHaveProperty('id');
      expect(mockProyectosService.create).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Nuevo Proyecto' }),
        MOCK_ADMIN_USER.uid,
        MOCK_ADMIN_USER.name,
      );
    });
  });

  // ─── PATCH /proyectos/:id ──────────────────────────────────────────────────

  describe('PATCH /proyectos/:id', () => {
    it('debe retornar 400 si el body de update no cumple el schema (nombre vacío)', async () => {
      await request(app.getHttpServer())
        .patch('/proyectos/proj-e2e-001')
        .set('Authorization', 'Bearer valid-token')
        .send({ nombre: '' }) // nombre no puede ser vacío
        .expect(400);
    });

    it('debe retornar 200 al actualizar correctamente', async () => {
      const { body } = await request(app.getHttpServer())
        .patch('/proyectos/proj-e2e-001')
        .set('Authorization', 'Bearer valid-token')
        .send({ nombre: 'Nombre Actualizado' })
        .expect(200);

      expect(body).toHaveProperty('id', 'proj-e2e-001');
    });
  });

  // ─── DELETE /proyectos/:id ─────────────────────────────────────────────────

  describe('DELETE /proyectos/:id', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).delete('/proyectos/proj-e2e-001').expect(401);
    });

    it('debe retornar 400 si el proyecto tiene transacciones asociadas', async () => {
      (mockProyectosService.remove as jest.Mock).mockRejectedValue(
        new BadRequestException('No se puede eliminar el proyecto porque tiene transacciones asociadas.'),
      );

      await request(app.getHttpServer())
        .delete('/proyectos/proj-con-txns')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);
    });

    it('debe retornar 200 al eliminar correctamente', async () => {
      (mockProyectosService.remove as jest.Mock).mockResolvedValue({
        message: 'Proyecto eliminado correctamente',
      });

      const { body } = await request(app.getHttpServer())
        .delete('/proyectos/proj-e2e-001')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(body.message).toContain('eliminado');
    });
  });
});
