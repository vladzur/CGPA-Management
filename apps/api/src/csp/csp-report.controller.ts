import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SetMetadata } from '@nestjs/common';
import { CspReportService } from './csp-report.service';

/**
 * Recibe reportes de violación de la Content-Security-Policy.
 *
 * Es público porque lo llama el navegador, pero no persiste nada: solo registra
 * la directiva violada. El límite de 60 reportes por minuto y por IP evita que
 * se convierta en un amplificador de logs.
 */
@Controller('csp-report')
export class CspReportController {
  constructor(private readonly cspReportService: CspReportService) {}

  @Post()
  // Misma clave que usa AccessPolicyGuard; el endpoint es público.
  @SetMetadata('access_policy', 'PUBLIC')
  @HttpCode(HttpStatus.NO_CONTENT)
  report(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): void {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const { allowed, retryAfterSeconds } = this.cspReportService.consume(ip);

    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      throw new HttpException(
        'Demasiados reportes CSP; reintenta más tarde',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.cspReportService.logReport(body);
  }
}
