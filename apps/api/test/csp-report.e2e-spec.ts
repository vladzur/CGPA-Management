/**
 * @file csp-report.e2e-spec.ts
 * @description Verifica que el endpoint de reportes CSP sea público, no escriba
 * datos y aplique el límite de 60 reportes por minuto.
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

describe('POST /csp-report (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => await app.close());

  it('debe aceptar un reporte sin token y responder 204', async () => {
    await request(app.getHttpServer())
      .post('/csp-report')
      .send({ 'csp-report': { 'violated-directive': 'script-src' } })
      .expect(204);
  });

  it('debe responder 429 después de 60 reportes desde la misma IP', async () => {
    for (let i = 0; i < 60; i += 1) {
      await request(app.getHttpServer())
        .post('/csp-report')
        .send({ 'csp-report': { 'violated-directive': 'img-src' } })
        .expect(204);
    }

    await request(app.getHttpServer())
      .post('/csp-report')
      .send({ 'csp-report': { 'violated-directive': 'img-src' } })
      .expect(429)
      .expect('Retry-After', /\d+/);
  });
});
