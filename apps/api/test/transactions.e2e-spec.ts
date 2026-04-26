/**
 * @file transactions.e2e-spec.ts
 * @description Tests de integración para el endpoint POST /transactions.
 * Verifica autenticación, validación de payload y respuesta exitosa.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { FinanzasService } from '../src/finanzas/finanzas.service';
import { StorageService } from '../src/storage/storage.service';

// ─── Mock global de firebase-admin para tests E2E ────────────────────────────
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  auth: jest.fn(),
  storage: jest.fn(),
  apps: [],
}));

import * as admin from 'firebase-admin';

// Token "válido" para tests — el guard verifyIdToken retornará esto
const VALID_TOKEN = 'valid-test-token';
const MOCK_USER = {
  uid: 'uid-editor',
  email: 'editor@test.cl',
  name: 'Editor Test',
  role: 'EDITOR',
  activo: true,
};

describe('TransactionsController (e2e)', () => {
  let app: INestApplication;
  let mockFinanzasService: jest.Mocked<Partial<FinanzasService>>;
  let mockStorageService: jest.Mocked<Partial<StorageService>>;

  beforeAll(async () => {
    // Stub admin.auth().verifyIdToken
    const mockAuth = { verifyIdToken: jest.fn().mockResolvedValue(MOCK_USER) };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);

    // Stubs de firestore y storage para evitar errores de inicialización
    const mockFirestore = { collection: jest.fn() };
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

    mockFinanzasService = {
      createTransaction: jest.fn().mockResolvedValue({
        id: 'txn-e2e-001',
        nuevo_saldo_total: 110000,
        proyecto_actualizado: null,
      }),
    };
    mockStorageService = {
      uploadReceipt: jest.fn().mockResolvedValue('https://storage.test/comprobante.jpg'),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(FinanzasService)
      .useValue(mockFinanzasService)
      .overrideProvider(StorageService)
      .useValue(mockStorageService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  describe('POST /transactions', () => {
    const validPayload = {
      tipo: 'INGRESO',
      monto: '10000',
      fecha: new Date().toISOString(),
      categoria: 'Aportes',
      descripcion: 'Aporte test E2E',
    };

    it('debe retornar 401 sin header Authorization', async () => {
      await request(app.getHttpServer())
        .post('/transactions')
        .send(validPayload)
        .expect(401);
    });

    it('debe retornar 401 con token inválido', async () => {
      const mockAuth = { verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid')) };
      (admin.auth as jest.Mock).mockReturnValue(mockAuth);

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', 'Bearer bad-token')
        .send(validPayload)
        .expect(401);

      // Restaurar mock válido para el resto de tests
      (admin.auth as jest.Mock).mockReturnValue({ verifyIdToken: jest.fn().mockResolvedValue(MOCK_USER) });
    });

    it('debe retornar 400 si el payload es inválido (monto negativo)', async () => {
      const invalidPayload = { ...validPayload, monto: '-500' };

      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(invalidPayload)
        .expect(400);
    });

    it('debe retornar 400 si faltan campos requeridos', async () => {
      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send({ tipo: 'INGRESO' }) // falta monto, fecha, etc.
        .expect(400);
    });

    it('debe retornar 201 con saldo actualizado en happy path', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .send(validPayload)
        .expect(201);

      expect(body.message).toContain('Transacción registrada');
      expect(body.data).toMatchObject({
        id: 'txn-e2e-001',
        nuevo_saldo_total: 110000,
      });
    });

    it('debe rechazar archivos no permitidos (video) con 400', async () => {
      await request(app.getHttpServer())
        .post('/transactions')
        .set('Authorization', `Bearer ${VALID_TOKEN}`)
        .field('tipo', 'INGRESO')
        .field('monto', '5000')
        .field('fecha', new Date().toISOString())
        .field('categoria', 'Aportes')
        .field('descripcion', 'Test')
        .attach('file', Buffer.from('fake-video'), { filename: 'video.mp4', contentType: 'video/mp4' })
        .expect(400);
    });
  });
});
