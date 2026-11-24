/**
 * @file documentos.e2e-spec.ts
 * @description Verifica la matriz de acceso de /documentos: el QR público sigue
 * funcionando sin token y toda la gestión queda reservada a un ADMIN activo.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { TestAppModule } from './test-app.module';
import { DocumentosService } from '../src/documentos/documentos.service';

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

const MOCK_INACTIVE_ADMIN = {
  uid: 'uid-inactive',
  email: 'inactivo@cgpa.cl',
  name: 'Inactivo',
  role: 'ADMIN',
  activo: false,
};

const MOCK_DOCUMENTO = {
  id: 'doc-e2e-001',
  titulo: 'Balance E2E',
  estado: 'SELLADO',
};

describe('DocumentosController (e2e)', () => {
  let app: INestApplication;
  let mockAuth: { verifyIdToken: jest.Mock };
  let mockDocumentosService: jest.Mocked<Partial<DocumentosService>>;

  beforeAll(async () => {
    mockAuth = { verifyIdToken: jest.fn().mockResolvedValue(MOCK_ADMIN) };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);
    (admin.firestore as jest.Mock).mockReturnValue({ collection: jest.fn() });

    mockDocumentosService = {
      findByVerificationUuid: jest.fn().mockResolvedValue({
        valido: true,
        titulo: 'Documento de prueba',
        hash_integridad: 'hash-de-prueba',
      }),
      findAll: jest.fn().mockResolvedValue([MOCK_DOCUMENTO]),
      findOne: jest.fn().mockResolvedValue(MOCK_DOCUMENTO),
      create: jest.fn().mockResolvedValue(MOCK_DOCUMENTO),
      update: jest.fn().mockResolvedValue(MOCK_DOCUMENTO),
      sellar: jest.fn().mockResolvedValue(MOCK_DOCUMENTO),
      generatePdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
      remove: jest.fn().mockResolvedValue({ message: 'Documento eliminado' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(DocumentosService)
      .useValue(mockDocumentosService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => await app.close());

  beforeEach(() => {
    mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN);
    jest.clearAllMocks();
    mockAuth.verifyIdToken.mockResolvedValue(MOCK_ADMIN);
  });

  describe('GET /documentos/validar/:uuid', () => {
    it('debe responder 200 sin token (RN-01)', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/documentos/validar/11111111-1111-4111-8111-111111111111')
        .expect(200);

      expect(body).toMatchObject({ valido: true });
      expect(mockDocumentosService.findByVerificationUuid).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111',
      );
    });
  });

  describe('administración de documentos', () => {
    it('debe retornar 401 sin token', async () => {
      await request(app.getHttpServer()).get('/documentos').expect(401);
    });

    it('debe retornar 403 con un token de APODERADO', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_APODERADO);

      await request(app.getHttpServer())
        .get('/documentos')
        .set('Authorization', 'Bearer apoderado-token')
        .expect(403);
    });

    it('debe retornar 403 con un ADMIN inactivo', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_INACTIVE_ADMIN);

      await request(app.getHttpServer())
        .get('/documentos')
        .set('Authorization', 'Bearer inactive-admin-token')
        .expect(403);
    });

    it('debe retornar 200 para un ADMIN activo', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/documentos')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      expect(body).toEqual([MOCK_DOCUMENTO]);
    });

    it('debe retornar 404 al eliminar un documento inexistente', async () => {
      (mockDocumentosService.remove as jest.Mock).mockRejectedValue(
        new NotFoundException('Documento no encontrado'),
      );

      await request(app.getHttpServer())
        .delete('/documentos/doc-inexistente')
        .set('Authorization', 'Bearer admin-token')
        .expect(404);
    });

    it('debe retornar 403 al eliminar con APODERADO', async () => {
      mockAuth.verifyIdToken.mockResolvedValue(MOCK_APODERADO);

      await request(app.getHttpServer())
        .delete('/documentos/doc-e2e-001')
        .set('Authorization', 'Bearer apoderado-token')
        .expect(403);

      expect(mockDocumentosService.remove).not.toHaveBeenCalled();
    });
  });
});
