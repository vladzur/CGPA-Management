/**
 * @file mensajes.e2e-spec.ts
 * @description Tests de integración del formulario público de contacto y de la
 * bandeja de la directiva. Cubre el alta anónima, la validación de payloads, el
 * filtro anti-spam y el control de acceso por rol.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { MensajesService } from '../src/mensajes/mensajes.service';

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

const MOCK_APODERADO_USER = {
  uid: 'uid-apoderado-e2e',
  email: 'apoderado@test.cl',
  name: 'Apoderado E2E',
  role: 'APODERADO',
  activo: true,
};

const MOCK_MENSAJE = {
  id: 'msg-e2e-001',
  nombre: 'Ana Apoderada',
  email: 'ana@example.cl',
  telefono: '+56911112222',
  motivo: 'CUOTAS_Y_PAGOS',
  mensaje: 'Consulta sobre el pago de la cuota anual.',
  estado: 'NUEVO',
  fecha_creacion: new Date(),
};

const VALID_BODY = {
  nombre: 'Ana Apoderada',
  email: 'ana@example.cl',
  telefono: '+56911112222',
  motivo: 'CUOTAS_Y_PAGOS',
  mensaje: 'Consulta sobre el pago de la cuota anual.',
};

describe('MensajesController (e2e)', () => {
  let app: INestApplication;
  let mockMensajesService: jest.Mocked<Partial<MensajesService>>;
  let mockAuth: { verifyIdToken: jest.Mock };

  beforeAll(async () => {
    mockAuth = {
      verifyIdToken: jest.fn().mockResolvedValue(MOCK_ADMIN_USER),
    };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);
    (admin.firestore as jest.Mock).mockReturnValue({ collection: jest.fn() });
    (admin.storage as jest.Mock).mockReturnValue({ bucket: jest.fn() });

    mockMensajesService = {
      create: jest.fn().mockResolvedValue(MOCK_MENSAJE),
      findAll: jest.fn().mockResolvedValue([MOCK_MENSAJE]),
      updateStatus: jest
        .fn()
        .mockResolvedValue({ ...MOCK_MENSAJE, estado: 'LEIDO' }),
      remove: jest.fn().mockResolvedValue({
        message: 'Mensaje eliminado correctamente',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(MensajesService)
      .useValue(mockMensajesService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());

  afterEach(() => {
    jest.clearAllMocks();
    mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN_USER);
  });

  // ─── POST /mensajes ─────────────────────────────────────────────────────────

  describe('POST /mensajes', () => {
    it('should accept a public submission without a token', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/mensajes')
        .send(VALID_BODY)
        .expect(201);

      expect(body).toHaveProperty('id', 'msg-e2e-001');
      expect(mockMensajesService.create).toHaveBeenCalledTimes(1);
    });

    it('should forward the message content to the service', async () => {
      await request(app.getHttpServer())
        .post('/mensajes')
        .send(VALID_BODY)
        .expect(201);

      expect(mockMensajesService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Ana Apoderada',
          email: 'ana@example.cl',
          motivo: 'CUOTAS_Y_PAGOS',
        }),
        expect.any(Object),
      );
    });

    it('should reject a submission with an invalid email', async () => {
      await request(app.getHttpServer())
        .post('/mensajes')
        .send({ ...VALID_BODY, email: 'no-es-un-correo' })
        .expect(400);

      expect(mockMensajesService.create).not.toHaveBeenCalled();
    });

    it('should reject a submission with a too short message', async () => {
      await request(app.getHttpServer())
        .post('/mensajes')
        .send({ ...VALID_BODY, mensaje: 'Hola' })
        .expect(400);
    });

    it('should reject a submission with an unknown reason', async () => {
      await request(app.getHttpServer())
        .post('/mensajes')
        .send({ ...VALID_BODY, motivo: 'MOTIVO_INVENTADO' })
        .expect(400);
    });

    it('should silently discard submissions that filled the honeypot field', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/mensajes')
        .send({ ...VALID_BODY, sitio_web: 'http://spam.example' })
        .expect(201);

      expect(body).toHaveProperty('recibido', true);
      expect(mockMensajesService.create).not.toHaveBeenCalled();
    });
  });

  // ─── GET /mensajes ──────────────────────────────────────────────────────────

  describe('GET /mensajes', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer()).get('/mensajes');

      expect(response.status).toBe(401);
    });

    it('should reject authenticated users without the admin role', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_APODERADO_USER);

      await request(app.getHttpServer())
        .get('/mensajes')
        .set('Authorization', 'Bearer apoderado-token')
        .expect(403);

      expect(mockMensajesService.findAll).not.toHaveBeenCalled();
    });

    it('should return the inbox for an active administrator', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/mensajes')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body[0]).toHaveProperty('id', 'msg-e2e-001');
    });

    it('should pass the status filter to the service', async () => {
      await request(app.getHttpServer())
        .get('/mensajes?estado=NUEVO')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(mockMensajesService.findAll).toHaveBeenCalledWith('NUEVO');
    });
  });

  // ─── PATCH /mensajes/:id ────────────────────────────────────────────────────

  describe('PATCH /mensajes/:id', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .patch('/mensajes/msg-e2e-001')
        .send({ estado: 'LEIDO' })
        .expect(401);
    });

    it('should update the status and report who attended the message', async () => {
      await request(app.getHttpServer())
        .patch('/mensajes/msg-e2e-001')
        .set('Authorization', 'Bearer admin-token')
        .send({ estado: 'LEIDO' })
        .expect(200);

      expect(mockMensajesService.updateStatus).toHaveBeenCalledWith(
        'msg-e2e-001',
        { estado: 'LEIDO' },
        'uid-admin-e2e',
        'Admin E2E',
      );
    });

    it('should reject an unknown status', async () => {
      await request(app.getHttpServer())
        .patch('/mensajes/msg-e2e-001')
        .set('Authorization', 'Bearer admin-token')
        .send({ estado: 'ESTADO_INVENTADO' })
        .expect(400);
    });

    it('should return 404 when the message does not exist', async () => {
      (mockMensajesService.updateStatus as jest.Mock).mockRejectedValue(
        new NotFoundException('Mensaje no encontrado'),
      );

      await request(app.getHttpServer())
        .patch('/mensajes/inexistente')
        .set('Authorization', 'Bearer admin-token')
        .send({ estado: 'LEIDO' })
        .expect(404);
    });
  });

  // ─── DELETE /mensajes/:id ───────────────────────────────────────────────────

  describe('DELETE /mensajes/:id', () => {
    it('should require authentication', async () => {
      const response = await request(app.getHttpServer()).delete(
        '/mensajes/msg-e2e-001',
      );

      expect(response.status).toBe(401);
    });

    it('should delete the message for an administrator', async () => {
      const { body } = await request(app.getHttpServer())
        .delete('/mensajes/msg-e2e-001')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(body).toHaveProperty('message');
      expect(mockMensajesService.remove).toHaveBeenCalledWith(
        'msg-e2e-001',
        'uid-admin-e2e',
        'Admin E2E',
      );
    });
  });
});
