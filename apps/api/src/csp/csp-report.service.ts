import { Injectable, Logger } from '@nestjs/common';

/** Ventana del límite de reportes CSP por IP. */
const RATE_WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 60;

interface RateBucket {
  timestamps: number[];
}

/**
 * Registra reportes de violación de CSP sin persistir datos personales.
 *
 * Solo se registra la directiva violada. La URL del documento, el agente del
 * usuario y el cuerpo completo se descartan para no crear una fuente de datos
 * personales ni un vector de inyección en logs.
 */
@Injectable()
export class CspReportService {
  private readonly logger = new Logger(CspReportService.name);
  private readonly buckets = new Map<string, RateBucket>();

  /**
   * Consume un reporte para la IP indicada.
   *
   * Devuelve `allowed: false` y los segundos de espera cuando se supera el
   * límite de 60 reportes por minuto.
   */
  consume(
    ip: string,
    now = Date.now(),
  ): { allowed: boolean; retryAfterSeconds: number } {
    const bucket = this.buckets.get(ip) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter(
      (timestamp) => now - timestamp < RATE_WINDOW_MS,
    );

    if (bucket.timestamps.length >= MAX_REPORTS_PER_WINDOW) {
      this.buckets.set(ip, bucket);
      const oldest = bucket.timestamps[0] ?? now;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000),
      );

      return { allowed: false, retryAfterSeconds };
    }

    bucket.timestamps.push(now);
    this.buckets.set(ip, bucket);

    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Extrae la directiva violada de un reporte CSP o de la Reporting API. */
  extractDirective(body: unknown): string | null {
    const report = this.firstReport(body);
    if (!report) return null;

    const directive =
      report['violated-directive'] ??
      report['effective-directive'] ??
      report.violatedDirective ??
      report.effectiveDirective;

    return typeof directive === 'string' && directive.length <= 120
      ? directive.replace(/[\r\n]/g, ' ')
      : null;
  }

  /** Registra solo la directiva; nunca la URL ni el cuerpo completo. */
  logReport(body: unknown): void {
    const directive = this.extractDirective(body);

    if (directive) {
      this.logger.warn(`Reporte CSP recibido para la directiva: ${directive}`);
    } else {
      this.logger.warn('Reporte CSP recibido sin directiva identificable');
    }
  }

  private firstReport(body: unknown): Record<string, unknown> | null {
    if (Array.isArray(body)) {
      return body.length > 0 ? this.firstReport(body[0]) : null;
    }

    if (!body || typeof body !== 'object') return null;

    const candidate = body as Record<string, unknown>;

    if (
      candidate['csp-report'] &&
      typeof candidate['csp-report'] === 'object'
    ) {
      return candidate['csp-report'] as Record<string, unknown>;
    }

    if (candidate.body && typeof candidate.body === 'object') {
      return candidate.body as Record<string, unknown>;
    }

    return candidate;
  }
}
