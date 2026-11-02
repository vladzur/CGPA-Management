import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { EstadoPago } from '@cgpa/shared';
import type {
  CobroCreado,
  PagoVerificado,
  PasarelaPago,
  SolicitudCobro,
} from '../pasarela-pago.interface';

/** Tiempo máximo de espera de una llamada a la API de Khipu. */
const KHIPU_TIMEOUT_MS = 10_000;

/** Respuesta de `POST /payments` de Khipu v3. */
interface KhipuPaymentCreated {
  payment_id?: string;
  payment_url?: string;
  simplified_transfer_url?: string;
  transfer_url?: string;
  app_url?: string;
  ready_for_terminal?: boolean;
}

/** Respuesta de `GET /payments/{notification_token}` de Khipu v3. */
interface KhipuPaymentDetail {
  payment_id?: string;
  subject?: string;
  amount?: number;
  currency?: string;
  status?: string;
  status_detail?: string;
  payer_email?: string;
  transaction_id?: string;
  notification_token?: string;
  bank?: string;
  payer_name?: string;
  transfer_date?: string;
  receipt_url?: string;
}

/**
 * Implementación de `PasarelaPago` para Khipu (API v3).
 *
 * Encapsula el payload, la autenticación con `x-api-key` y la traducción de los
 * estados de Khipu al vocabulario interno.
 */
@Injectable()
export class KhipuPasarela implements PasarelaPago {
  readonly id = 'khipu' as const;
  readonly nombre = 'Khipu';

  private readonly logger = new Logger(KhipuPasarela.name);

  async crearCobro(solicitud: SolicitudCobro): Promise<CobroCreado> {
    const apiKey = this.obtenerApiKey();

    const respuesta = await this.llamar<KhipuPaymentCreated>(
      '/payments',
      {
        method: 'POST',
        body: JSON.stringify({
          subject: solicitud.asunto,
          currency: 'CLP',
          amount: solicitud.monto,
          transaction_id: solicitud.transactionId,
          payer_email: solicitud.pagadorEmail,
          payer_name: solicitud.pagadorNombre,
          return_url: solicitud.urlRetorno,
          cancel_url: solicitud.urlCancelacion,
          notify_url: solicitud.urlNotificacion,
          notify_api_version: '1.3',
          expires_date: solicitud.expiraEn,
        }),
      },
      apiKey,
    );

    if (!respuesta?.payment_id || !respuesta?.payment_url) {
      this.logger.error(
        `Khipu no devolvió payment_id/payment_url para ${solicitud.transactionId}`,
      );
      throw new BadGatewayException('Khipu no devolvió una URL de pago válida');
    }

    return {
      referenciaExterna: respuesta.payment_id,
      urlPago: respuesta.payment_url,
    };
  }

  extraerReferenciaNotificacion(
    payload: Record<string, unknown>,
  ): string | null {
    const token = payload?.['notification_token'];

    return typeof token === 'string' && token.trim().length > 0
      ? token.trim()
      : null;
  }

  async verificarPago(referencia: string): Promise<PagoVerificado | null> {
    const apiKey = this.obtenerApiKey();
    const detalle = await this.llamar<KhipuPaymentDetail>(
      `/payments/${encodeURIComponent(referencia)}`,
      { method: 'GET' },
      apiKey,
    );

    const transactionId = detalle?.transaction_id?.trim();
    if (!transactionId) {
      this.logger.warn(
        'Khipu no informó transaction_id; se ignora para no acreditar un pago sin referencia local.',
      );
      return null;
    }

    const verificado: PagoVerificado = {
      transactionId,
      monto: Number(detalle.amount),
      moneda: (detalle.currency ?? 'CLP').toUpperCase(),
      estado: this.mapearEstado(detalle.status),
    };

    if (detalle.status_detail) verificado.estadoDetalle = detalle.status_detail;
    if (detalle.payment_id) verificado.referenciaExterna = detalle.payment_id;
    if (detalle.bank) verificado.banco = detalle.bank;

    return verificado;
  }

  // ─── Helpers internos ──────────────────────────────────────────────────────

  private obtenerApiKey(): string {
    const apiKey = process.env.KHIPU_API_KEY?.trim();

    if (!apiKey) {
      this.logger.error('KHIPU_API_KEY no está configurada');
      throw new ServiceUnavailableException(
        'La pasarela de pagos Khipu no está configurada',
      );
    }

    return apiKey;
  }

  private mapearEstado(status?: string): EstadoPago {
    switch ((status ?? '').toLowerCase()) {
      case 'done':
        return 'PAGADO';
      case 'cancelled':
        return 'CANCELADO';
      case 'failed':
        return 'FALLIDO';
      default:
        // `pending` y `verifying` siguen pendientes de confirmación bancaria.
        return 'PENDIENTE';
    }
  }

  private async llamar<T>(
    path: string,
    init: RequestInit,
    apiKey: string,
  ): Promise<T> {
    const baseUrl = (
      process.env.KHIPU_API_BASE_URL ?? 'https://khipu.com/api/v3'
    ).replace(/\/+$/, '');

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          ...init.headers,
        },
        signal: AbortSignal.timeout(KHIPU_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.error(`Khipu respondió HTTP ${response.status} en ${path}`);
        throw new BadGatewayException('Khipu rechazó la solicitud de pago');
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      this.logger.error(
        `Error de comunicación con Khipu en ${path}: ${(error as Error).message}`,
      );
      throw new BadGatewayException(
        'No se pudo comunicar con la pasarela de pagos',
      );
    }
  }
}
