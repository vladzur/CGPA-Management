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
      const footerHeight = 110;

      // ─── ENCABEZADO ──────────────────────────────────────────────

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#1a1a1a')
        .text('CENTRO GENERAL DE PADRES Y APODERADOS', { align: 'center' });

      doc
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#555555')
        .text('Liceo Alexander Graham Bell', { align: 'center' });

      doc.fillColor('#000000');
      doc.moveDown(0.3);

      // Línea decorativa
      const headerLineY = doc.y;
      doc
        .lineWidth(2)
        .moveTo(marginX + 30, headerLineY)
        .lineTo(pageWidth - marginX - 30, headerLineY)
        .stroke('#2c3e50');
      doc.moveDown(0.5);

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#2c3e50')
        .text('COMPROBANTE DIGITAL', { align: 'center' });

      doc.fillColor('#000000');
      doc.moveDown(1.5);

      // ─── TÍTULO ──────────────────────────────────────────────────

      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(documento.titulo, { align: 'center' });
      doc.moveDown(1);

      // ─── TABLA DE DATOS ──────────────────────────────────────────

      const colConcepto = Math.round(usableWidth * 0.45);
      const colValor = usableWidth - colConcepto;
      const rowHeight = 24;
      const colValorX = marginX + colConcepto;
      const tableTop = doc.y;

      const filas = [
        {
          label: 'Monto',
          value: `$${documento.monto.toLocaleString('es-CL')}`,
        },
        {
          label: 'Fecha de Emisión',
          value: fechaEmision.toLocaleDateString('es-CL'),
        },
        { label: 'RUT Emisor', value: documento.rut_emisor },
      ];

      // Fondo cabecera
      doc
        .rect(marginX, tableTop, usableWidth, rowHeight)
        .fill('#2c3e50');

      // Texto cabecera
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#ffffff');
      doc.text('Concepto', marginX + 8, tableTop + 6, {
        width: colConcepto - 16,
      });
      doc.text('Valor', colValorX + 8, tableTop + 6, {
        width: colValor - 16,
      });
      doc.fillColor('#000000');

      // Filas de datos
      let rowY = tableTop + rowHeight;
      for (const fila of filas) {
        doc
          .lineWidth(0.5)
          .rect(marginX, rowY, usableWidth, rowHeight)
          .stroke('#cccccc');

        doc.font('Helvetica').fontSize(10);
        doc.text(fila.label, marginX + 8, rowY + 5, {
          width: colConcepto - 16,
        });
        doc.text(fila.value, colValorX + 8, rowY + 5, {
          width: colValor - 16,
        });

        rowY += rowHeight;
      }

      // Posicionar cursor debajo de la tabla y resetear X al margen
      doc.x = marginX;
      doc.y = rowY + 12;

      // ─── DESCRIPCIÓN ─────────────────────────────────────────────

      doc.font('Helvetica').fontSize(12);
      doc.text(`Descripción: ${documento.descripcion}`, marginX, doc.y, {
        width: usableWidth,
        align: 'left',
      });

      // ─── FOOTER ──────────────────────────────────────────────────

      const footerTop = Math.max(
        doc.y + 30,
        pageHeight - marginX - footerHeight,
      );

      // Línea separadora
      doc
        .lineWidth(1)
        .moveTo(marginX, footerTop)
        .lineTo(pageWidth - marginX, footerTop)
        .stroke('#cccccc');

      const footerTextY = footerTop + 12;
      const hashShort =
        documento.hash_integridad?.substring(0, 8) ?? '--------';

      doc
        .font('Helvetica')
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

      // QR code (derecha)
      if (documento.qr_base64) {
        const qrSize = 100;
        const qrX = pageWidth - marginX - qrSize;
        const qrY = footerTop + 5;

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
