import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { Documento } from '@cgpa/shared';

@Injectable()
export class DocumentoIntegrityService {
  private readonly logger = new Logger(DocumentoIntegrityService.name);

  /**
   * Computa hash SHA-256 para verificación de integridad del documento.
   * Payload: ID_Documento + Fecha_Emision + Monto + Rut_Emisor + Secret_Key
   */
  computeHash(
    id: string,
    fechaEmision: string,
    monto: number,
    rutEmisor: string,
    salt: string,
  ): string {
    const payload = `${id}${fechaEmision}${monto}${rutEmisor}${salt}`;
    return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  }

  /**
   * Genera un código QR como data URL PNG en base64.
   */
  async generateQR(verificationUrl: string): Promise<string> {
    return QRCode.toDataURL(verificationUrl, {
      width: 300,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  }

  /**
   * Genera un buffer PDF para un documento sellado.
   * Incluye el código QR y los primeros 8 caracteres del hash en el pie de página.
   */
  generatePDFBuffer(documento: Documento): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 60, left: 50, right: 50 },
        size: 'A4',
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fechaEmision =
        documento.fecha_emision instanceof Date
          ? documento.fecha_emision
          : new Date(
              (documento.fecha_emision as any).toDate?.() ??
                documento.fecha_emision,
            );

      // Título
      doc.fontSize(18).text(documento.titulo, { align: 'center' });
      doc.moveDown(1);

      // Datos del documento
      doc
        .fontSize(12)
        .text(`Monto: $${documento.monto.toLocaleString('es-CL')}`, {
          continued: false,
        });
      doc.text(`Fecha de Emisión: ${fechaEmision.toLocaleDateString('es-CL')}`);
      doc.text(`RUT Emisor: ${documento.rut_emisor}`);
      doc.moveDown(0.5);
      doc.text(`Descripción: ${documento.descripcion}`);

      // Hash en pie de página (izquierda)
      const hashShort =
        documento.hash_integridad?.substring(0, 8) ?? '--------';
      const bottomY = doc.page.height - 50;

      doc
        .fontSize(8)
        .text(`Hash: ${hashShort}`, 50, bottomY, { width: 300, align: 'left' });

      // QR en pie de página (derecha) — 2x2 cm ≈ 56px a 72dpi
      if (documento.qr_base64) {
        const qrBuffer = Buffer.from(
          documento.qr_base64.replace(/^data:image\/png;base64,/, ''),
          'base64',
        );
        doc.image(qrBuffer, doc.page.width - 106, bottomY - 10, {
          width: 56,
          height: 56,
        });
      }

      doc.end();
    });
  }
}
