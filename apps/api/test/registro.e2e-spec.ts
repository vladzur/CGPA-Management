/**
 * @file registro.e2e-spec.ts
 * @description Verifica la contención del registro público: mientras
 * `REGISTRO_HABILITADO` no esté en `true`, el endpoint responde 403 y no crea cuentas.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  auth: jest.fn(),
  storage: jest.fn(),
  apps: [],
}));

import * as admin from 'firebase-admin';

const MOCK_NEW_USER = {
  uid: 'uid-new',
  email: 'nuevo@cgpa.cl',
  name: 'Nuevo',
  role: undefined,
  activo: undefined,
};

describe('Registro público (e2e)', () => {
  let app: INestApplication;
  const originalFlag = process.env.REGISTRO_HABILITADO;

  beforeAll(async () => {
    (admin.auth as jest.Mock).mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue(MOCK_NEW_USER),
    });
    (admin.firestore as jest.Mock).mockReturnValue({ collection: jest.fn() });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (originalFlag === undefined) {
      delete process.env.REGISTRO_HABILITADO;
    } else {
      process.env.REGISTRO_HABILITADO = originalFlag;
    }
    await app.close();
  });

  beforeEach(() => {
    delete process.env.REGISTRO_HABILITADO;
  });

  it('debe retornar 403 cuando el registro está cerrado', async () => {
    await request(app.getHttpServer())
      .post('/usuarios/registro')
      .set('Authorization', 'Bearer new-user-token')
      .expect(403);
  });

  it('debe retornar 401 sin token aunque el registro esté cerrado', async () => {
    await request(app.getHttpServer()).post('/usuarios/registro').expect(401);
  });
});
