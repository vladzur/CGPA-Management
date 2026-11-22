import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { KhipuPasarela } from './khipu-pasarela';
import { ErrorPasarela, type SolicitudCobro } from '../pasarela-pago.interface';

const SOLICITUD: SolicitudCobro = {
  transactionId: 'CGPA-PAY-2026-ABC123',
  asunto: 'CGPA - Cuota anual 2027',
  monto: 10000,
  pagadorEmail: 'apoderado@ejemplo.cl',
  pagadorNombre: 'Juan Pérez',
  urlRetorno:
    'https://app.cgpa.test/pagar/confirmacion?transaction_id=CGPA-PAY-2026-ABC123',
  urlCancelacion:
    'https://app.cgpa.test/pagar/cancelado?transaction_id=CGPA-PAY-2026-ABC123',
  urlNotificacion: 'https://api.cgpa.test/api/pagos/khipu/webhook',
  expiraEn: '2026-12-31T23:59:59Z',
};

function makeDetalle(overrides: Record<string, any> = {}) {
  return {
    payment_id: 'abc123xyz456',
    subject: 'CGPA - Cuota anual 2027',
    amount: 10000,
    currency: 'CLP',
    status: 'done',
    status_detail: 'normal',
    transaction_id: SOLICITUD.transactionId,
    notification_token: 'token-seguro',
    conciliation_date: '2026-11-02T16:09:00.859Z',
    bank: 'Banco Estado',
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): any {
  return { ok, status, json: jest.fn().mockResolvedValue(body) };
}

function errorResponse(status: number, body = ''): any {
  return {
    ok: false,
    status,
    text: jest.fn().mockResolvedValue(body),
    json: jest.fn(),
  };
}

describe('KhipuPasarela', () => {
  let pasarela: KhipuPasarela;
  let mockFetch: jest.Mock;

  beforeEach(async () => {
    mockFetch = jest.fn();
    Object.defineProperty(global, 'fetch', {
      value: mockFetch,
      writable: true,
      configurable: true,
    });

    process.env.KHIPU_API_KEY = 'test-api-key';
    process.env.KHIPU_API_BASE_URL = 'https://khipu.test/v3';

    const module: TestingModule = await Test.createTestingModule({
      providers: [KhipuPasarela],
    }).compile();

    pasarela = module.get<KhipuPasarela>(KhipuPasarela);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.KHIPU_API_KEY;
    delete process.env.KHIPU_API_BASE_URL;
  });

  it('should expose its identifier and display name', () => {
    expect(pasarela.id).toBe('khipu');
    expect(pasarela.nombre).toBe('Khipu');
  });

  // ─── crearCobro ────────────────────────────────────────────────────────────

  describe('crearCobro', () => {
    it('should post the documented payload and return the payment url', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          payment_id: 'abc123xyz456',
          payment_url: 'https://khipu.com/payment/info/abc123xyz456',
        }),
      );

      const cobro = await pasarela.crearCobro(SOLICITUD);
      const [url, options] = mockFetch.mock.calls[0];
      const payload = JSON.parse(options.body);

      expect(cobro).toEqual({
        referenciaExterna: 'abc123xyz456',
        urlPago: 'https://khipu.com/payment/info/abc123xyz456',
      });
      expect(url).toBe('https://khipu.test/v3/payments');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({
        'Content-Type': 'application/json',
        'x-api-key': 'test-api-key',
      });
      expect(payload).toMatchObject({
        subject: 'CGPA - Cuota anual 2027',
        currency: 'CLP',
        amount: 10000,
        transaction_id: 'CGPA-PAY-2026-ABC123',
        payer_email: 'apoderado@ejemplo.cl',
        payer_name: 'Juan Pérez',
        return_url: SOLICITUD.urlRetorno,
        cancel_url: SOLICITUD.urlCancelacion,
        notify_url: SOLICITUD.urlNotificacion,
        notify_api_version: '3.0',
        expires_date: '2026-12-31T23:59:59Z',
      });
    });

    it('should fail when the api key is not configured', async () => {
      delete process.env.KHIPU_API_KEY;

      await expect(pasarela.crearCobro(SOLICITUD)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should normalize an error response without body', async () => {
      mockFetch.mockResolvedValue(errorResponse(403));

      await expect(pasarela.crearCobro(SOLICITUD)).rejects.toMatchObject({
        detalle: {
          proveedor: 'khipu',
          operacion: 'CREAR_COBRO',
          status: 403,
          codigo: 'HTTP_403',
          mensaje: expect.stringContaining('HTTP 403'),
        },
      });
      await expect(pasarela.crearCobro(SOLICITUD)).rejects.toBeInstanceOf(
        ErrorPasarela,
      );
    });

    it('should extract the provider code and message from a json error', async () => {
      mockFetch.mockResolvedValue(
        errorResponse(
          400,
          JSON.stringify({
            error: 'bad_request',
            message: 'El monto supera el límite de la cuenta',
          }),
        ),
      );

      await expect(pasarela.crearCobro(SOLICITUD)).rejects.toMatchObject({
        detalle: {
          status: 400,
          codigo: 'bad_request',
          mensaje: expect.stringContaining('El monto supera el límite'),
        },
      });
    });

    it('should normalize a network failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(pasarela.crearCobro(SOLICITUD)).rejects.toMatchObject({
        detalle: {
          status: null,
          codigo: 'NETWORK',
          mensaje: 'No se pudo comunicar con la pasarela de pagos',
        },
      });
    });

    it('should reject a response without payment url', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ payment_id: 'p1' }));

      await expect(pasarela.crearCobro(SOLICITUD)).rejects.toMatchObject({
        detalle: {
          status: 200,
          codigo: 'RESPUESTA_INVALIDA',
        },
      });
    });
  });

  // ─── extraerReferenciaNotificacion ─────────────────────────────────────────

  describe('extraerReferenciaNotificacion', () => {
    it('should read the payment id sent by the 3.0 notification api', () => {
      expect(
        pasarela.extraerReferenciaNotificacion({
          payment_id: 'abc123xyz456',
          transaction_id: 'CGPA-PAY-2026-ABC123',
        }),
      ).toBe('abc123xyz456');
    });

    it('should prefer the payment id over a legacy notification token', () => {
      expect(
        pasarela.extraerReferenciaNotificacion({
          payment_id: 'abc123xyz456',
          notification_token: 'token-seguro',
        }),
      ).toBe('abc123xyz456');
    });

    it('should read the legacy notification token', () => {
      expect(
        pasarela.extraerReferenciaNotificacion({
          notification_token: 'token-seguro',
        }),
      ).toBe('token-seguro');
    });

    it('should trim the token', () => {
      expect(
        pasarela.extraerReferenciaNotificacion({
          notification_token: '  token-seguro ',
        }),
      ).toBe('token-seguro');
    });

    it('should return null when the token is missing or invalid', () => {
      expect(pasarela.extraerReferenciaNotificacion({})).toBeNull();
      expect(
        pasarela.extraerReferenciaNotificacion({ notification_token: '   ' }),
      ).toBeNull();
      expect(
        pasarela.extraerReferenciaNotificacion({ notification_token: 42 }),
      ).toBeNull();
    });
  });

  // ─── verificarPago ─────────────────────────────────────────────────────────

  describe('verificarPago', () => {
    it('should query the payment with the api key and normalize it', async () => {
      mockFetch.mockResolvedValue(jsonResponse(makeDetalle()));

      const verificado = await pasarela.verificarPago('token-seguro');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://khipu.test/v3/payments/token-seguro',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'x-api-key': 'test-api-key' }),
        }),
      );
      expect(verificado).toEqual({
        transactionId: SOLICITUD.transactionId,
        monto: 10000,
        moneda: 'CLP',
        estado: 'PAGADO',
        estadoDetalle: 'normal',
        referenciaExterna: 'abc123xyz456',
        banco: 'Banco Estado',
        pagadoEn: new Date('2026-11-02T16:09:00.859Z'),
      });
    });

    it.each([
      ['done', 'PAGADO'],
      ['verifying', 'PENDIENTE'],
      ['pending', 'PENDIENTE'],
      ['cancelled', 'CANCELADO'],
      ['failed', 'FALLIDO'],
      ['desconocido', 'PENDIENTE'],
      [undefined, 'PENDIENTE'],
    ])('should map the %s status to %s', async (status, esperado) => {
      mockFetch.mockResolvedValue(
        jsonResponse(makeDetalle({ status, bank: undefined })),
      );

      const verificado = await pasarela.verificarPago('token-seguro');

      expect(verificado?.estado).toBe(esperado);
      expect(verificado).not.toHaveProperty('banco');
    });

    it('should default the currency to CLP when Khipu omits it', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(makeDetalle({ currency: undefined })),
      );

      const verificado = await pasarela.verificarPago('token-seguro');

      expect(verificado?.moneda).toBe('CLP');
    });

    it('should ignore an unparseable conciliation date', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(makeDetalle({ conciliation_date: 'no-es-una-fecha' })),
      );

      const verificado = await pasarela.verificarPago('abc123xyz456');

      expect(verificado).not.toHaveProperty('pagadoEn');
    });

    it('should return null when Khipu does not report a transaction id', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(makeDetalle({ transaction_id: undefined })),
      );

      await expect(pasarela.verificarPago('token-seguro')).resolves.toBeNull();
    });

    it('should escape the reference in the request path', async () => {
      mockFetch.mockResolvedValue(jsonResponse(makeDetalle()));

      await pasarela.verificarPago('a/b?c');

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://khipu.test/v3/payments/a%2Fb%3Fc',
      );
    });

    it('should require the api key', async () => {
      delete process.env.KHIPU_API_KEY;

      await expect(pasarela.verificarPago('token-seguro')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should normalize a verification error with the verify operation', async () => {
      mockFetch.mockResolvedValue(errorResponse(500, 'error interno'));

      await expect(
        pasarela.verificarPago('token-seguro'),
      ).rejects.toMatchObject({
        detalle: {
          operacion: 'VERIFICAR_PAGO',
          status: 500,
          codigo: 'HTTP_500',
        },
      });
    });
  });
});
