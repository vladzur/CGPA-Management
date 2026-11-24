/**
 * @file libro-balance.e2e-spec.ts
 * @description Verifica que la generación del libro de balance exija un ADMIN activo.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { LibroBalanceService } from '../src/libro-balance/libro-balance.service';

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  auth: jest.fn(),
  storage: jest.fn(),
  apps: [],
}));

import * as admin from 'firebase-admin';

const MOCK_ADMIN = {
  uid: 'uid-admin',
  email: 'admin@cgpa.cl',
  name: 'Admin',
  role: 'ADMIN',
  activo: true,
};

const MOCK_APODERADO = {
  uid: 'uid-apoderado',
  email: 'apoderado@cgpa.cl',
  name: 'Apoderado',
  role: 'APODERADO',
  activo: true,
};

describe('LibroBalanceController (e2e)', () => {
  let app: INestApplication;
  let mockAuth: { verifyIdToken: jest.Mock };
  let mockLibroBalanceService: jest.Mocked<Partial<LibroBalanceService>>;

  beforeAll(async () => {
    mockAuth = { verifyIdToken: jest.fn().mockResolvedValue(MOCK_ADMIN) };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);
    (admin.firestore as jest.Mock).mockReturnValue({ collection: jest.fn() });

    mockLibroBalanceService = {
      generateBalanceBook: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(LibroBalanceService)
      .useValue(mockLibroBalanceService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN);
  });

  const payload = { periodo: '2026', modo: 'borrador' };

  it('debe retornar 401 sin token', async () => {
    await request(app.getHttpServer())
      .post('/libro-balance/generar')
      .send(payload)
      .expect(401);
  });

  it('debe retornar 403 con un token de APODERADO', async () => {
    mockAuth.verifyIdToken.mockResolvedValue(MOCK_APODERADO);

    await request(app.getHttpServer())
      .post('/libro-balance/generar')
      .set('Authorization', 'Bearer apoderado-token')
      .send(payload)
      .expect(403);

    expect(mockLibroBalanceService.generateBalanceBook).not.toHaveBeenCalled();
  });

  it('debe generar el PDF para un ADMIN activo', async () => {
    await request(app.getHttpServer())
      .post('/libro-balance/generar')
      .set('Authorization', 'Bearer admin-token')
      .send(payload)
      .expect(201)
      .expect('Content-Type', /application\/pdf/);

    expect(mockLibroBalanceService.generateBalanceBook).toHaveBeenCalledWith(
      expect.objectContaining({ periodo: '2026' }),
      MOCK_ADMIN.uid,
      MOCK_ADMIN.name,
    );
  });
});
