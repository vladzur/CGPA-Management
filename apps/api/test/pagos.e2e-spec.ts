/**
 * @file pagos.e2e-spec.ts
 * @description Tests de integración del botón de pago Khipu. Cubre la creación
 * pública de cobros, la validación del payload, el webhook (JSON y
 * form-urlencoded), la consulta de estado y el acceso restringido al historial.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { PagosService } from '../src/pagos/pagos.service';

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

const VALID_BODY = {
  concepto: 'Cuota anual 2027',
  monto: 10000,
  pagador_email: 'apoderado@ejemplo.cl',
  pagador_nombre: 'Juan Pérez',
};

const MOCK_PAGO = {
  transaction_id: 'CGPA-PAY-2026-ABC123',
  proveedor: 'khipu',
  asunto: 'CGPA - Cuota anual 2027',
  moneda: 'CLP',
  monto: 10000,
  estado: 'PENDIENTE',
  creado_en: new Date(),
  actualizado_en: new Date(),
};

describe('PagosController (e2e)', () => {
  let app: INestApplication;
  let mockPagosService: jest.Mocked<Partial<PagosService>>;
  let mockAuth: { verifyIdToken: jest.Mock };

  beforeAll(async () => {
    mockAuth = {
      verifyIdToken: jest.fn().mockResolvedValue(MOCK_ADMIN_USER),
    };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);
    (admin.firestore as jest.Mock).mockReturnValue({ collection: jest.fn() });
    (admin.storage as jest.Mock).mockReturnValue({ bucket: jest.fn() });

    mockPagosService = {
      crearPago: jest.fn().mockResolvedValue({
        transaction_id: 'CGPA-PAY-2026-ABC123',
        proveedor: 'khipu',
        payment_url: 'https://khipu.com/payment/info/abc123xyz456',
        referencia_externa: 'abc123xyz456',
      }),
      procesarNotificacion: jest
        .fn()
        .mockResolvedValue({ actualizado: true, estado: 'PAGADO' }),
      consultarPago: jest.fn().mockResolvedValue(MOCK_PAGO),
      listarPagos: jest.fn().mockResolvedValue([MOCK_PAGO]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(PagosService)
      .useValue(mockPagosService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());

  afterEach(() => {
    jest.clearAllMocks();
    mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN_USER);
  });

  // ─── POST /pagos/khipu ─────────────────────────────────────────────────────

  describe('POST /pagos/khipu', () => {
    it('should create a payment without authentication', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/pagos/khipu')
        .send(VALID_BODY)
        .expect(201);

      expect(body).toEqual({
        transaction_id: 'CGPA-PAY-2026-ABC123',
        proveedor: 'khipu',
        payment_url: 'https://khipu.com/payment/info/abc123xyz456',
        referencia_externa: 'abc123xyz456',
      });
      expect(mockPagosService.crearPago).toHaveBeenCalledWith('khipu', {
        concepto: 'Cuota anual 2027',
        monto: 10000,
        pagador_email: 'apoderado@ejemplo.cl',
        pagador_nombre: 'Juan Pérez',
      });
    });

    it('should reject an invalid payer email', async () => {
      await request(app.getHttpServer())
        .post('/pagos/khipu')
        .send({ ...VALID_BODY, pagador_email: 'no-es-un-correo' })
        .expect(400);

      expect(mockPagosService.crearPago).not.toHaveBeenCalled();
    });

    it('should reject a non integer amount', async () => {
      await request(app.getHttpServer())
        .post('/pagos/khipu')
        .send({ ...VALID_BODY, monto: 1000.5 })
        .expect(400);
    });

    it('should reject a too low amount', async () => {
      await request(app.getHttpServer())
        .post('/pagos/khipu')
        .send({ ...VALID_BODY, monto: 1 })
        .expect(400);
    });

    it('should reject an amount above the maximum', async () => {
      await request(app.getHttpServer())
        .post('/pagos/khipu')
        .send({ ...VALID_BODY, monto: 10_000_001 })
        .expect(400);
    });

    it('should reject a missing concept', async () => {
      await request(app.getHttpServer())
        .post('/pagos/khipu')
        .send({ ...VALID_BODY, concepto: '  ' })
        .expect(400);
    });
  });

  // ─── POST /pagos/khipu/webhook ─────────────────────────────────────────────

  describe('POST /pagos/khipu/webhook', () => {
    it('should verify a JSON notification', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/pagos/khipu/webhook')
        .send({ notification_token: 'token-seguro' })
        .expect(200);

      expect(body).toEqual({ recibido: true, estado: 'PAGADO' });
      expect(mockPagosService.procesarNotificacion).toHaveBeenCalledWith(
        'khipu',
        { notification_token: 'token-seguro' },
      );
    });

    it('should accept a form-urlencoded notification', async () => {
      await request(app.getHttpServer())
        .post('/pagos/khipu/webhook')
        .type('form')
        .send({ notification_token: 'token-form' })
        .expect(200);

      expect(mockPagosService.procesarNotificacion).toHaveBeenCalledWith(
        'khipu',
        { notification_token: 'token-form' },
      );
    });

    it('should ignore a notification without token', async () => {
      (
        mockPagosService.procesarNotificacion as jest.Mock
      ).mockResolvedValueOnce({ actualizado: false, estado: null });

      const { body } = await request(app.getHttpServer())
        .post('/pagos/khipu/webhook')
        .send({})
        .expect(200);

      expect(body).toEqual({ recibido: true, estado: null });
    });

    it('should reject a gateway that is not supported', async () => {
      (
        mockPagosService.procesarNotificacion as jest.Mock
      ).mockRejectedValueOnce(
        new BadRequestException('Método de pago no soportado: webpay'),
      );

      await request(app.getHttpServer())
        .post('/pagos/webpay/webhook')
        .send({ token_ws: 'abc' })
        .expect(400);
    });
  });

  // ─── GET /pagos/:transactionId ─────────────────────────────────────────────

  describe('GET /pagos/:transactionId', () => {
    it('should expose the public status of a payment', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/pagos/CGPA-PAY-2026-ABC123')
        .expect(200);

      expect(body).toMatchObject({ transaction_id: 'CGPA-PAY-2026-ABC123' });
      expect(mockPagosService.consultarPago).toHaveBeenCalledWith(
        'CGPA-PAY-2026-ABC123',
      );
    });

    it('should return 404 when the payment does not exist', async () => {
      (mockPagosService.consultarPago as jest.Mock).mockRejectedValueOnce(
        new NotFoundException('El pago solicitado no existe'),
      );

      await request(app.getHttpServer()).get('/pagos/desconocido').expect(404);
    });
  });

  // ─── GET /pagos ────────────────────────────────────────────────────────────

  describe('GET /pagos', () => {
    it('should require an authentication token', async () => {
      await request(app.getHttpServer()).get('/pagos').expect(401);

      expect(mockPagosService.listarPagos).not.toHaveBeenCalled();
    });

    it('should reject a user without the ADMIN role', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_APODERADO_USER);

      await request(app.getHttpServer())
        .get('/pagos')
        .set('Authorization', 'Bearer token-apoderado')
        .expect(403);

      expect(mockPagosService.listarPagos).not.toHaveBeenCalled();
    });

    it('should list payments for an active admin', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/pagos')
        .set('Authorization', 'Bearer token-admin')
        .expect(200);

      expect(body).toHaveLength(1);
      expect(mockPagosService.listarPagos).toHaveBeenCalledTimes(1);
    });
  });
});
