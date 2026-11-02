import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { PasarelasService } from './pasarelas/pasarelas.service';
import type { PasarelaPago } from './pasarelas/pasarela-pago.interface';
import {
  createMockFirestore,
  createMockDocumentRef,
  createMockDocSnapshot,
  createMissingDocSnapshot,
  createMockTransaction,
  createQuerySnapshot,
} from '../__mocks__/firebase-admin.mock';

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';

const TRANSACTION_ID = 'CGPA-PAY-2026-ABC123';

const DTO = {
  concepto: 'Cuota anual 2027',
  monto: 10000,
  pagador_email: 'apoderado@ejemplo.cl',
  pagador_nombre: 'Juan Pérez',
};

function makePago(overrides: Record<string, any> = {}) {
  return {
    transaction_id: TRANSACTION_ID,
    proveedor: 'khipu',
    referencia_externa: 'abc123xyz456',
    asunto: 'CGPA - Cuota anual 2027',
    moneda: 'CLP',
    monto: 10000,
    pagador_email: 'apoderado@ejemplo.cl',
    pagador_nombre: 'Juan Pérez',
    estado: 'PENDIENTE',
    url_pago: 'https://khipu.com/payment/info/abc123xyz456',
    creado_en: new Date(),
    actualizado_en: new Date(),
    ...overrides,
  };
}

function makeVerificado(overrides: Record<string, any> = {}) {
  return {
    transactionId: TRANSACTION_ID,
    monto: 10000,
    moneda: 'CLP',
    estado: 'PAGADO',
    estadoDetalle: 'normal',
    referenciaExterna: 'abc123xyz456',
    banco: 'Banco Estado',
    ...overrides,
  };
}

describe('PagosService', () => {
  let service: PagosService;
  let mockFirestore: ReturnType<typeof createMockFirestore>;
  let pasarela: jest.Mocked<PasarelaPago>;
  let mockPasarelas: { obtener: jest.Mock };

  beforeEach(async () => {
    mockFirestore = createMockFirestore();
    (admin.firestore as any).FieldValue = {
      serverTimestamp: jest.fn(() => 'SERVER_TS'),
    };
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

    pasarela = {
      id: 'khipu',
      nombre: 'Khipu',
      crearCobro: jest.fn(),
      extraerReferenciaNotificacion: jest.fn(),
      verificarPago: jest.fn(),
    };
    mockPasarelas = { obtener: jest.fn().mockReturnValue(pasarela) };

    process.env.CLIENT_BASE_URL = 'https://app.cgpa.test';
    process.env.PUBLIC_API_URL = 'https://api.cgpa.test/api';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: PasarelasService, useValue: mockPasarelas },
      ],
    }).compile();

    service = module.get<PagosService>(PagosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.CLIENT_BASE_URL;
    delete process.env.PUBLIC_API_URL;
    delete process.env.VERIFICATION_BASE_URL;
    delete process.env.PAGO_TTL_DIAS;
  });

  function setupDocRef(id = TRANSACTION_ID) {
    const docRef = createMockDocumentRef(id);
    const collection: any = { doc: jest.fn().mockReturnValue(docRef) };
    mockFirestore.collection.mockReturnValue(collection);
    return { collection, docRef };
  }

  function setupTransaction(snapshot: any) {
    const transaction = createMockTransaction();
    transaction.get.mockResolvedValue(snapshot);
    mockFirestore.runTransaction.mockImplementation((fn: any) =>
      fn(transaction),
    );
    return transaction;
  }

  // ─── crearPago ─────────────────────────────────────────────────────────────

  describe('crearPago', () => {
    it('should delegate to the requested gateway and persist a pending payment', async () => {
      const { docRef } = setupDocRef();
      docRef.set.mockResolvedValue(undefined as any);
      pasarela.crearCobro.mockResolvedValue({
        referenciaExterna: 'abc123xyz456',
        urlPago: 'https://khipu.com/payment/info/abc123xyz456',
      });

      const resultado = await service.crearPago('khipu', DTO);

      expect(mockPasarelas.obtener).toHaveBeenCalledWith('khipu');
      expect(resultado.transaction_id).toMatch(/^CGPA-PAY-\d{4}-[A-F0-9]{16}$/);
      expect(resultado).toMatchObject({
        proveedor: 'khipu',
        payment_url: 'https://khipu.com/payment/info/abc123xyz456',
        referencia_externa: 'abc123xyz456',
      });

      expect(docRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_id: resultado.transaction_id,
          proveedor: 'khipu',
          referencia_externa: 'abc123xyz456',
          estado: 'PENDIENTE',
          moneda: 'CLP',
          monto: 10000,
          pagador_email: 'apoderado@ejemplo.cl',
        }),
      );
    });

    it('should build the gateway request with server-generated references', async () => {
      setupDocRef().docRef.set.mockResolvedValue(undefined as any);
      pasarela.crearCobro.mockResolvedValue({
        referenciaExterna: 'abc123xyz456',
        urlPago: 'https://khipu.com/payment/info/abc123xyz456',
      });

      const resultado = await service.crearPago('khipu', DTO);
      const solicitud = pasarela.crearCobro.mock.calls[0][0];

      expect(solicitud).toMatchObject({
        transactionId: resultado.transaction_id,
        asunto: 'CGPA - Cuota anual 2027',
        monto: 10000,
        pagadorEmail: 'apoderado@ejemplo.cl',
        pagadorNombre: 'Juan Pérez',
        urlNotificacion: 'https://api.cgpa.test/api/pagos/khipu/webhook',
      });
      expect(solicitud.urlRetorno).toBe(
        `https://app.cgpa.test/pagar/confirmacion?transaction_id=${resultado.transaction_id}`,
      );
      expect(solicitud.urlCancelacion).toBe(
        `https://app.cgpa.test/pagar/cancelado?transaction_id=${resultado.transaction_id}`,
      );
      expect(new Date(solicitud.expiraEn).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it('should derive the notification url from the public site when no api url is set', async () => {
      delete process.env.PUBLIC_API_URL;
      process.env.VERIFICATION_BASE_URL = 'https://cgpagrahambell.cl';
      setupDocRef().docRef.set.mockResolvedValue(undefined as any);
      pasarela.crearCobro.mockResolvedValue({
        referenciaExterna: 'p1',
        urlPago: 'https://khipu.test/pay/p1',
      });

      await service.crearPago('khipu', DTO);

      expect(pasarela.crearCobro.mock.calls[0][0].urlNotificacion).toBe(
        'https://cgpagrahambell.cl/api/pagos/khipu/webhook',
      );
    });

    it('should fall back to localhost when no public url is configured', async () => {
      delete process.env.PUBLIC_API_URL;
      setupDocRef().docRef.set.mockResolvedValue(undefined as any);
      pasarela.crearCobro.mockResolvedValue({
        referenciaExterna: 'p1',
        urlPago: 'https://khipu.test/pay/p1',
      });

      await service.crearPago('khipu', DTO);

      expect(pasarela.crearCobro.mock.calls[0][0].urlNotificacion).toBe(
        'http://localhost:3000/api/pagos/khipu/webhook',
      );
    });

    it('should honour PAGO_TTL_DIAS when configured', async () => {
      process.env.PAGO_TTL_DIAS = '1';
      setupDocRef().docRef.set.mockResolvedValue(undefined as any);
      pasarela.crearCobro.mockResolvedValue({
        referenciaExterna: 'p1',
        urlPago: 'https://khipu.test/pay/p1',
      });

      await service.crearPago('khipu', DTO);

      const expires = new Date(
        pasarela.crearCobro.mock.calls[0][0].expiraEn,
      ).getTime();
      const unDia = 24 * 60 * 60 * 1000;

      expect(expires).toBeGreaterThan(Date.now() + unDia - 60_000);
      expect(expires).toBeLessThan(Date.now() + unDia + 60_000);
    });

    it('should propagate a gateway failure without persisting anything', async () => {
      const { docRef } = setupDocRef();
      pasarela.crearCobro.mockRejectedValue(new BadGatewayException('caído'));

      await expect(service.crearPago('khipu', DTO)).rejects.toThrow(
        BadGatewayException,
      );
      expect(docRef.set).not.toHaveBeenCalled();
    });
  });

  // ─── procesarNotificacion ──────────────────────────────────────────────────

  describe('procesarNotificacion', () => {
    it('should verify with the gateway and mark the payment as paid', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago()),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token-seguro');
      pasarela.verificarPago.mockResolvedValue(makeVerificado());

      const resultado = await service.procesarNotificacion('khipu', {
        notification_token: 'token-seguro',
      });

      expect(pasarela.verificarPago).toHaveBeenCalledWith('token-seguro');
      expect(resultado).toEqual({
        actualizado: true,
        estado: 'PAGADO',
        transactionId: TRANSACTION_ID,
      });

      const [, cambios] = transaction.update.mock.calls[0];
      expect(cambios).toMatchObject({
        estado: 'PAGADO',
        estado_detalle: 'normal',
        banco: 'Banco Estado',
        token_notificacion: 'token-seguro',
        pagado_en: expect.any(Date),
      });
    });

    it('should ignore a notification without a reference', async () => {
      pasarela.extraerReferenciaNotificacion.mockReturnValue(null);

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado).toEqual({
        actualizado: false,
        estado: null,
        transactionId: null,
      });
      expect(pasarela.verificarPago).not.toHaveBeenCalled();
      expect(mockFirestore.runTransaction).not.toHaveBeenCalled();
    });

    it('should ignore a notification the gateway cannot identify', async () => {
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token-seguro');
      pasarela.verificarPago.mockResolvedValue(null);

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado).toEqual({
        actualizado: false,
        estado: null,
        transactionId: null,
      });
      expect(mockFirestore.runTransaction).not.toHaveBeenCalled();
    });

    it('should be idempotent when the payment is already paid', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago({ estado: 'PAGADO' })),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(makeVerificado());

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado).toEqual({
        actualizado: false,
        estado: 'PAGADO',
        transactionId: TRANSACTION_ID,
      });
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it('should not regress a paid payment with a late verifying notice', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago({ estado: 'PAGADO' })),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(
        makeVerificado({ estado: 'PENDIENTE' }),
      );

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado.actualizado).toBe(false);
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it('should preserve a previously stored payment date', async () => {
      const pagadoEn = new Date('2026-01-01T12:00:00Z');
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(
          TRANSACTION_ID,
          makePago({ estado: 'PENDIENTE', pagado_en: pagadoEn }),
        ),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(
        makeVerificado({ pagadoEn: new Date('2026-02-02T00:00:00Z') }),
      );

      await service.procesarNotificacion('khipu', {});

      const [, cambios] = transaction.update.mock.calls[0];
      expect(cambios.pagado_en).toBe(pagadoEn);
    });

    it('should use the gateway payment date when the record has none', async () => {
      const pagadoEn = new Date('2026-02-02T00:00:00Z');
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago()),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(makeVerificado({ pagadoEn }));

      await service.procesarNotificacion('khipu', {});

      const [, cambios] = transaction.update.mock.calls[0];
      expect(cambios.pagado_en).toBe(pagadoEn);
    });

    it('should ignore a notification whose amount does not match', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago()),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(makeVerificado({ monto: 1000 }));

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado).toEqual({
        actualizado: false,
        estado: 'PENDIENTE',
        transactionId: TRANSACTION_ID,
      });
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it('should ignore a notification whose currency does not match', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago()),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(
        makeVerificado({ moneda: 'USD' }),
      );

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado.actualizado).toBe(false);
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it('should ignore a notification from another gateway', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago({ proveedor: 'khipu' })),
      );
      pasarela.id = 'webpay' as never;
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(makeVerificado());

      const resultado = await service.procesarNotificacion('webpay', {});

      expect(resultado).toEqual({
        actualizado: false,
        estado: 'PENDIENTE',
        transactionId: TRANSACTION_ID,
      });
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it('should ignore a notification for an unknown payment', async () => {
      setupDocRef();
      const transaction = setupTransaction(createMissingDocSnapshot());
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(makeVerificado());

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado).toEqual({
        actualizado: false,
        estado: null,
        transactionId: TRANSACTION_ID,
      });
      expect(transaction.update).not.toHaveBeenCalled();
    });

    it('should mark a cancelled payment', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago()),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(
        makeVerificado({ estado: 'CANCELADO', banco: undefined }),
      );

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado).toEqual({
        actualizado: true,
        estado: 'CANCELADO',
        transactionId: TRANSACTION_ID,
      });

      const [, cambios] = transaction.update.mock.calls[0];
      expect(cambios).toMatchObject({ estado: 'CANCELADO', pagado_en: null });
      expect(cambios).not.toHaveProperty('banco');
    });

    it('should mark a failed payment', async () => {
      setupDocRef();
      setupTransaction(createMockDocSnapshot(TRANSACTION_ID, makePago()));
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(
        makeVerificado({ estado: 'FALLIDO' }),
      );

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado).toEqual({
        actualizado: true,
        estado: 'FALLIDO',
        transactionId: TRANSACTION_ID,
      });
    });

    it('should keep the payment pending while the gateway is verifying', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago()),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(
        makeVerificado({ estado: 'PENDIENTE', banco: undefined }),
      );

      const resultado = await service.procesarNotificacion('khipu', {});

      expect(resultado).toEqual({
        actualizado: true,
        estado: 'PENDIENTE',
        transactionId: TRANSACTION_ID,
      });
      const [, cambios] = transaction.update.mock.calls[0];
      expect(cambios).not.toHaveProperty('banco');
    });

    it('should keep the current reference when the gateway does not report one', async () => {
      setupDocRef();
      const transaction = setupTransaction(
        createMockDocSnapshot(TRANSACTION_ID, makePago()),
      );
      pasarela.extraerReferenciaNotificacion.mockReturnValue('token');
      pasarela.verificarPago.mockResolvedValue(
        makeVerificado({ referenciaExterna: undefined }),
      );

      await service.procesarNotificacion('khipu', {});

      const [, cambios] = transaction.update.mock.calls[0];
      expect(cambios).not.toHaveProperty('referencia_externa');
    });
  });

  // ─── consultarPago ─────────────────────────────────────────────────────────

  describe('consultarPago', () => {
    it('should throw when the payment does not exist', async () => {
      const { docRef } = setupDocRef();
      docRef.get.mockResolvedValue(createMissingDocSnapshot());

      await expect(service.consultarPago('desconocido')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return only public fields', async () => {
      const { docRef } = setupDocRef();
      docRef.get.mockResolvedValue(
        createMockDocSnapshot(
          TRANSACTION_ID,
          makePago({ token_notificacion: 'token-seguro' }),
        ),
      );

      const pago = await service.consultarPago(TRANSACTION_ID);

      expect(pago).not.toHaveProperty('token_notificacion');
      expect(pago).not.toHaveProperty('pagador_email');
      expect(pago).toMatchObject({
        transaction_id: TRANSACTION_ID,
        proveedor: 'khipu',
        estado: 'PENDIENTE',
        monto: 10000,
      });
    });

    it('should reconcile a pending payment that already has a token', async () => {
      const { docRef } = setupDocRef();
      docRef.get
        .mockResolvedValueOnce(
          createMockDocSnapshot(
            TRANSACTION_ID,
            makePago({ token_notificacion: 'token-seguro' }),
          ),
        )
        .mockResolvedValueOnce(
          createMockDocSnapshot(
            TRANSACTION_ID,
            makePago({ estado: 'PAGADO', pagado_en: new Date() }),
          ),
        );
      pasarela.verificarPago.mockResolvedValue(makeVerificado());
      const actualizar = jest.spyOn<any, any>(
        service as any,
        'aplicarVerificacion',
      );

      const pago = await service.consultarPago(TRANSACTION_ID);

      expect(pasarela.verificarPago).toHaveBeenCalledWith('token-seguro');
      expect(actualizar).toHaveBeenCalledWith(
        'khipu',
        expect.objectContaining({ estado: 'PAGADO' }),
        'token-seguro',
      );
      expect(pago.estado).toBe('PAGADO');
    });

    it('should keep the local state when the gateway cannot be reached', async () => {
      const { docRef } = setupDocRef();
      docRef.get.mockResolvedValue(
        createMockDocSnapshot(
          TRANSACTION_ID,
          makePago({ token_notificacion: 'token-seguro' }),
        ),
      );
      pasarela.verificarPago.mockRejectedValue(
        new BadGatewayException('sin conexión'),
      );

      const pago = await service.consultarPago(TRANSACTION_ID);

      expect(pago.estado).toBe('PENDIENTE');
    });

    it('should keep the local state when the gateway returns nothing', async () => {
      const { docRef } = setupDocRef();
      docRef.get.mockResolvedValue(
        createMockDocSnapshot(
          TRANSACTION_ID,
          makePago({ token_notificacion: 'token-seguro' }),
        ),
      );
      pasarela.verificarPago.mockResolvedValue(null);
      const actualizar = jest.spyOn<any, any>(
        service as any,
        'aplicarVerificacion',
      );

      const pago = await service.consultarPago(TRANSACTION_ID);

      expect(actualizar).not.toHaveBeenCalled();
      expect(pago.estado).toBe('PENDIENTE');
    });

    it('should not reconcile when there is no notification token', async () => {
      const { docRef } = setupDocRef();
      docRef.get.mockResolvedValue(
        createMockDocSnapshot(TRANSACTION_ID, makePago()),
      );

      await service.consultarPago(TRANSACTION_ID);

      expect(pasarela.verificarPago).not.toHaveBeenCalled();
    });
  });

  // ─── listarPagos ───────────────────────────────────────────────────────────

  describe('listarPagos', () => {
    it('should return the latest payments without notification tokens', async () => {
      const querySnapshot = createQuerySnapshot([
        {
          id: TRANSACTION_ID,
          data: makePago({ token_notificacion: 'token-seguro' }),
        },
      ]);
      const fakeQuery = { get: jest.fn().mockResolvedValue(querySnapshot) };
      const limitedQuery = { limit: jest.fn().mockReturnValue(fakeQuery) };
      const orderedQuery = {
        orderBy: jest.fn().mockReturnValue(limitedQuery),
      };
      mockFirestore.collection.mockReturnValue(orderedQuery as any);

      const pagos = await service.listarPagos();

      expect(pagos).toHaveLength(1);
      expect(pagos[0].id).toBe(TRANSACTION_ID);
      expect(pagos[0]).not.toHaveProperty('token_notificacion');
      expect(orderedQuery.orderBy).toHaveBeenCalledWith('creado_en', 'desc');
      expect(limitedQuery.limit).toHaveBeenCalledWith(200);
    });
  });
});
