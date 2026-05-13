import { Injectable, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import PDFDocument from 'pdfkit';
import { Transaccion, Documento } from '@cgpa/shared';
import { DocumentosService } from '../documentos/documentos.service';
import { GenerateBalanceBookDto } from './dto/generate-balance-book.dto';

interface Totals {
  ingresos: number;
  egresos: number;
  balance: number;
  count: number;
}

interface PdfRow {
  secuencia: number;
  fecha: string;
  tipo: string;
  categoria: string;
  descripcion: string;
  monto: number;
}

@Injectable()
export class LibroBalanceService {
  constructor(private readonly documentosService: DocumentosService) {}

  private get db() {
    return admin.firestore();
  }

  private getRutEmisor(dto: GenerateBalanceBookDto): string {
    return dto.rut_emisor || process.env.CGPA_RUT || 'XX.XXX.XXX-X';
  }

  /**
   * Orquesta la generación del libro de balance: consulta transacciones,
   * crea un Documento, lo sella y genera el PDF enriquecido.
   *
   * En modo "borrador" omite la creación y sellado del Documento MVI,
   * generando un PDF sin hash ni QR.
   */
  async generateBalanceBook(
    dto: GenerateBalanceBookDto,
    userUid: string,
    userName: string,
  ): Promise<Buffer> {
    const { start, end } = this.resolveDateRange(dto);
    const modo = dto.modo ?? 'firmado';

    const transacciones = await this.queryTransactions(
      start,
      end,
      dto.proyecto_id,
    );

    if (transacciones.length === 0) {
      throw new BadRequestException(
        'No se encontraron transacciones en el período especificado',
      );
    }

    const totals = this.calculateTotals(transacciones);
    const periodoLabel = this.buildPeriodoLabel(dto, start, end);

    if (modo === 'borrador') {
      return this.generateBalanceBookPDF(
        null,
        transacciones,
        totals,
        periodoLabel,
        dto,
      );
    }

    // Modo firmado: flujo completo con MVI
    const titulo = dto.titulo || `Libro de Balance - Período ${dto.periodo}`;
    const descripcion = this.buildDescripcion(periodoLabel, totals);

    const documentoCreado = await this.documentosService.create(
      {
        titulo,
        descripcion,
        monto: totals.balance,
        fecha_emision: end,
        rut_emisor: this.getRutEmisor(dto),
        estado: 'BORRADOR',
      },
      userUid,
      userName,
    );

    const documentoSellado = await this.documentosService.sellar(
      documentoCreado.id,
      userUid,
      userName,
    );

    const documento = await this.documentosService.findOne(documentoSellado.id);

    return this.generateBalanceBookPDF(
      documento as unknown as Documento,
      transacciones,
      totals,
      periodoLabel,
      dto,
    );
  }

  /**
   * Resuelve el rango de fechas a partir del DTO.
   */
  private resolveDateRange(dto: GenerateBalanceBookDto): {
    start: Date;
    end: Date;
  } {
    const year = Number.parseInt(dto.periodo, 10);

    const start = dto.fecha_inicio
      ? new Date(dto.fecha_inicio)
      : new Date(year, 0, 1); // 1 de enero

    const end = dto.fecha_fin
      ? new Date(dto.fecha_fin)
      : new Date(year, 11, 31, 23, 59, 59, 999); // 31 de diciembre

    return { start, end };
  }

  /**
   * Consulta transacciones en Firestore dentro del rango de fechas.
   */
  private async queryTransactions(
    start: Date,
    end: Date,
    proyecto_id?: string,
  ): Promise<Transaccion[]> {
    let query: admin.firestore.Query = this.db
      .collection('transacciones')
      .where('fecha', '>=', admin.firestore.Timestamp.fromDate(start))
      .where('fecha', '<=', admin.firestore.Timestamp.fromDate(end))
      .orderBy('numero_secuencia', 'asc');

    if (proyecto_id) {
      query = this.db
        .collection('transacciones')
        .where('proyecto_id', '==', proyecto_id)
        .where('fecha', '>=', admin.firestore.Timestamp.fromDate(start))
        .where('fecha', '<=', admin.firestore.Timestamp.fromDate(end))
        .orderBy('numero_secuencia', 'asc');
    }

    const snapshot = await query.get();
    return snapshot.docs.map(
      (doc: admin.firestore.DocumentSnapshot) =>
        ({ id: doc.id, ...doc.data() }) as unknown as Transaccion,
    );
  }

  /**
   * Calcula los totales de ingresos, egresos y balance neto.
   */
  private calculateTotals(transacciones: Transaccion[]): Totals {
    let ingresos = 0;
    let egresos = 0;

    for (const t of transacciones) {
      if (t.tipo === 'INGRESO') {
        ingresos += t.monto;
      } else {
        egresos += t.monto;
      }
    }

    return {
      ingresos,
      egresos,
      balance: ingresos - egresos,
      count: transacciones.length,
    };
  }

  /**
   * Construye la etiqueta del período para mostrar en el PDF.
   */
  private buildPeriodoLabel(
    dto: GenerateBalanceBookDto,
    start: Date,
    end: Date,
  ): string {
    if (dto.fecha_inicio || dto.fecha_fin) {
      return `${start.toLocaleDateString('es-CL')} - ${end.toLocaleDateString('es-CL')}`;
    }
    return dto.periodo;
  }

  /**
   * Construye la descripción del Documento a partir de los totales.
   */
  private buildDescripcion(periodoLabel: string, totals: Totals): string {
    return (
      `Libro de Balance del período ${periodoLabel}. ` +
      `Total Ingresos: $${totals.ingresos.toLocaleString('es-CL')}, ` +
      `Total Egresos: $${totals.egresos.toLocaleString('es-CL')}, ` +
      `Balance Neto: $${totals.balance.toLocaleString('es-CL')}, ` +
      `Transacciones: ${totals.count}`
    );
  }

  /**
   * Convierte transacciones al formato de fila para el PDF.
   */
  private toPdfRows(transacciones: Transaccion[]): PdfRow[] {
    return transacciones.map((t) => {
      const fecha =
        t.fecha instanceof Date
          ? t.fecha
          : new Date((t.fecha as any).toDate?.() ?? t.fecha);

      return {
        secuencia: t.numero_secuencia ?? 0,
        fecha: fecha.toLocaleDateString('es-CL'),
        tipo: t.tipo,
        categoria: t.categoria,
        descripcion: t.descripcion,
        monto: t.monto,
      };
    });
  }

  /**
   * Genera el PDF enriquecido del libro de balance con tabla de transacciones.
   *
   * @param documento - Documento sellado (null en modo borrador)
   * @param dto - DTO con los parámetros de generación (RUT emisor, título, etc.)
   */
  private generateBalanceBookPDF(
    documento: Documento | null,
    transacciones: Transaccion[],
    totals: Totals,
    periodoLabel: string,
    dto: GenerateBalanceBookDto,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 60, left: 40, right: 40 },
        size: 'A4',
      });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const rows = this.toPdfRows(transacciones);
      const pageWidth = doc.page.width;
      const marginLeft = 40;
      const usableWidth = pageWidth - marginLeft - 40;

      // Anchos de columnas
      const colSec = 28;
      const colFecha = 58;
      const colTipo = 48;
      const colCat = 70;
      const colMonto = 70;
      const colDesc =
        usableWidth - colSec - colFecha - colTipo - colCat - colMonto;

      const colX = {
        sec: marginLeft,
        fecha: marginLeft + colSec,
        tipo: marginLeft + colSec + colFecha,
        cat: marginLeft + colSec + colFecha + colTipo,
        desc: marginLeft + colSec + colFecha + colTipo + colCat,
        monto: marginLeft + colSec + colFecha + colTipo + colCat + colDesc,
      };

      const rowHeight = 16;
      const footerHeight = 70;
      const rutEmisor = documento?.rut_emisor || this.getRutEmisor(dto);
      const titulo =
        documento?.titulo ||
        dto.titulo ||
        `Libro de Balance - Período ${dto.periodo}`;

      // ─── ENCABEZADO ──────────────────────────────────────────────
      doc.fontSize(16).text('CGPA - Liceo AGB', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(13).text(titulo.toUpperCase(), { align: 'center' });
      doc.moveDown(0.5);

      doc.fontSize(9).text(`Período: ${periodoLabel}`, { align: 'center' });
      doc
        .fontSize(9)
        .text(
          `Generado el ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          { align: 'center' },
        );
      doc.fontSize(9).text(`RUT Emisor: ${rutEmisor}`, { align: 'center' });

      if (transacciones[0]?.proyecto_id) {
        doc.fontSize(9).text(`Proyecto: ${transacciones[0].proyecto_id}`, {
          align: 'center',
        });
      }

      // Marca de agua BORRADOR
      if (!documento) {
        doc
          .fontSize(10)
          .fillColor('#8B0000')
          .text('BORRADOR - Sin firma digital', { align: 'center' });
        doc.fillColor('#000000');
      }

      doc.moveDown(1);

      // ─── FUNCIÓN AUX: dibujar cabecera de tabla ──────────────────
      const drawTableHeader = (y: number): number => {
        // Fondo de cabecera
        doc.rect(marginLeft, y, usableWidth, rowHeight).fill('#e0e0e0');

        doc.fillColor('#000000').fontSize(8).font('Helvetica-Bold');

        doc.text('#', colX.sec, y + 4, { width: colSec, align: 'center' });
        doc.text('Fecha', colX.fecha + 2, y + 4, { width: colFecha - 4 });
        doc.text('Tipo', colX.tipo + 2, y + 4, { width: colTipo - 4 });
        doc.text('Categoría', colX.cat + 2, y + 4, { width: colCat - 4 });
        doc.text('Descripción', colX.desc + 2, y + 4, { width: colDesc - 4 });
        doc.text('Monto', colX.monto, y + 4, {
          width: colMonto,
          align: 'right',
        });

        // Línea inferior de cabecera
        doc
          .moveTo(marginLeft, y + rowHeight)
          .lineTo(pageWidth - 40, y + rowHeight)
          .stroke();

        return y + rowHeight;
      };

      // ─── DIBUJAR FILAS ───────────────────────────────────────────
      let y = drawTableHeader(doc.y);

      for (let i = 0; i < rows.length; i++) {
        // Salto de página si no hay espacio suficiente
        if (y + rowHeight > doc.page.height - footerHeight) {
          doc.addPage();
          y = drawTableHeader(50);
        }

        const row = rows[i];

        // Fondo alternado
        if (i % 2 === 0) {
          doc.rect(marginLeft, y, usableWidth, rowHeight).fill('#f8f8f8');
        }

        doc.fillColor('#000000').fontSize(8).font('Helvetica');

        doc.text(String(row.secuencia), colX.sec, y + 4, {
          width: colSec,
          align: 'center',
        });
        doc.text(row.fecha, colX.fecha + 2, y + 4, { width: colFecha - 4 });

        // Color según tipo
        const tipoColor = row.tipo === 'INGRESO' ? '#006400' : '#8B0000';
        doc.fillColor(tipoColor).text(row.tipo, colX.tipo + 2, y + 4, {
          width: colTipo - 4,
        });

        doc.fillColor('#000000');
        doc.text(row.categoria, colX.cat + 2, y + 4, { width: colCat - 4 });

        // Descripción con truncado si es muy larga
        doc.text(row.descripcion, colX.desc + 2, y + 4, {
          width: colDesc - 4,
          lineBreak: false,
        });

        doc.text(`$${row.monto.toLocaleString('es-CL')}`, colX.monto, y + 4, {
          width: colMonto,
          align: 'right',
        });

        // Línea separadora sutil
        doc
          .moveTo(marginLeft, y + rowHeight)
          .lineTo(pageWidth - 40, y + rowHeight)
          .stroke('#e0e0e0');

        y += rowHeight;
      }

      // Línea final de tabla
      doc
        .moveTo(marginLeft, y)
        .lineTo(pageWidth - 40, y)
        .stroke('#000000');

      // ─── RESUMEN ─────────────────────────────────────────────────
      doc.moveDown(1.5);

      const resumenX = marginLeft + 20;
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('RESUMEN', marginLeft, doc.y);
      doc.moveDown(0.5);

      doc.fontSize(10).font('Helvetica');
      const resumenLineas = [
        `Total Ingresos:       $${totals.ingresos.toLocaleString('es-CL')}`,
        `Total Egresos:         $${totals.egresos.toLocaleString('es-CL')}`,
        `Balance Neto:          $${totals.balance.toLocaleString('es-CL')}`,
        `Total Transacciones:   ${totals.count}`,
      ];

      for (const linea of resumenLineas) {
        doc.text(linea, resumenX, doc.y);
        doc.moveDown(0.3);
      }

      // ─── PIE DE PÁGINA (hash + QR o marca de borrador) ──────────
      // Reserva espacio para el footer; si el resumen está muy abajo, salta a nueva página
      const libroFooterHeight = 120;
      const hasQR = documento?.qr_base64;
      const pageH = doc.page.height;

      if (doc.y > pageH - libroFooterHeight) {
        doc.addPage();
      }

      const footerY = pageH - 70;
      const marginX = 40;
      // Línea separadora
      doc
        .moveTo(marginX, footerY)
        .lineTo(pageWidth - marginX, footerY)
        .stroke('#cccccc');

      if (documento) {
        const hashShort =
          documento.hash_integridad?.substring(0, 8) ?? '--------';

        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#333333')
          .text(`Hash: ${hashShort}`, marginX, footerY + 10, {
            width: hasQR ? 340 : usableWidth,
            align: 'left',
          });

        if (documento.uuid_verificacion) {
          doc
            .fontSize(7)
            .fillColor('#888888')
            .text(
              `UUID: ${documento.uuid_verificacion}`,
              marginX,
              footerY + 24,
              { width: hasQR ? 340 : usableWidth, align: 'left' },
            );
        }

        if (hasQR && documento.qr_base64) {
          const qrSize = 90;
          const qrX = pageWidth - marginX - qrSize;
          const qrY = footerY + 5;

          doc.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6).fill('#ffffff');

          const qrBuffer = Buffer.from(
            documento.qr_base64.replace(/^data:image\/png;base64,/, ''),
            'base64',
          );
          doc.image(qrBuffer, qrX, qrY, {
            width: qrSize,
            height: qrSize,
          });
        }
      } else {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#8B0000')
          .text('BORRADOR - Sin firma digital', marginX, footerY + 12, {
            width: usableWidth,
            align: 'left',
          });
      }

      doc.end();
    });
  }
}
