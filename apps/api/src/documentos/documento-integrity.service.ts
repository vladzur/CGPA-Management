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
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
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

      const pageHeight = doc.page.height;
      const pageWidth = doc.page.width;
      const marginX = 50;
      const usableWidth = pageWidth - marginX * 2;
      const footerHeight = 110; // espacio reservado para hash + QR
      const contentBottom = pageHeight - marginX - footerHeight;

      // ─── CONTENIDO ──────────────────────────────────────────────────

      // Título
      doc.fontSize(18).text(documento.titulo, {
        align: 'center',
        continued: false,
      });
      doc.moveDown(1);

      // Datos del documento
      doc.fontSize(12);
      doc.text(`Monto: $${documento.monto.toLocaleString('es-CL')}`);
      doc.text(`Fecha de Emisión: ${fechaEmision.toLocaleDateString('es-CL')}`);
      doc.text(`RUT Emisor: ${documento.rut_emisor}`);
      doc.moveDown(0.5);

      // Descripción (puede ser larga — dejamos que fluya con control de espacio)
      doc.text(`Descripción: ${documento.descripcion}`, {
        width: usableWidth,
      });

      // ─── VERIFICAR ESPACIO PARA FOOTER ──────────────────────────────

      // Si el contenido sobrepasó el área de contenido, ir a nueva página
      if (doc.y > contentBottom) {
        doc.addPage();
      }

      // Posicionar cursor al fondo de la página actual
      const bottomY = pageHeight - marginX - footerHeight + 20;

      // Línea separadora
      doc
        .moveTo(marginX, bottomY)
        .lineTo(pageWidth - marginX, bottomY)
        .stroke('#cccccc');

      // ─── PIE: HASH (izquierda) + QR (derecha) ───────────────────────

      const footerTextY = bottomY + 12;
      const hashShort =
        documento.hash_integridad?.substring(0, 8) ?? '--------';

      doc
        .fontSize(9)
        .fillColor('#333333')
        .text(`Hash de integridad: ${hashShort}`, marginX, footerTextY, {
          width: usableWidth * 0.55,
          align: 'left',
        });

      doc
        .fontSize(8)
        .fillColor('#888888')
        .text(
          `UUID: ${documento.uuid_verificacion ?? '--------'}`,
          marginX,
          footerTextY + 14,
          { width: usableWidth * 0.55, align: 'left' },
        );

      // QR code (derecha) — más grande: ~3.5 cm ≈ 100px
      if (documento.qr_base64) {
        const qrSize = 100;
        const qrX = pageWidth - marginX - qrSize;
        const qrY = bottomY + 5;

        // Fondo blanco detrás del QR para asegurar legibilidad
        doc.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8).fill('#ffffff');

        const qrBuffer = Buffer.from(
          documento.qr_base64.replace(/^data:image\/png;base64,/, ''),
          'base64',
        );
        doc.image(qrBuffer, qrX, qrY, {
          width: qrSize,
          height: qrSize,
        });
      }

      doc.end();
    });
  }
}
