import { Test, TestingModule } from '@nestjs/testing';
import { DocumentoIntegrityService } from './documento-integrity.service';

jest.mock('qrcode', () => ({
  toDataURL: jest
    .fn()
    .mockResolvedValue('data:image/png;base64,mocked-qr-data'),
}));

jest.mock('pdfkit', () => {
  const mockDoc: any = {
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'data') {
        cb(Buffer.from('fake-pdf-content'));
      }
      if (event === 'end') {
        cb();
      }
      return mockDoc;
    }),
    font: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    rect: jest.fn().mockReturnThis(),
    fill: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    moveTo: jest.fn().mockReturnThis(),
    lineTo: jest.fn().mockReturnThis(),
    lineWidth: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    end: jest.fn(),
    x: 50,
    y: 50,
    page: { height: 842, width: 595 },
  };

  const PDFDocument = jest.fn(() => mockDoc);

  return {
    __esModule: true,
    default: PDFDocument,
  };
});

import PDFDocument from 'pdfkit';

describe('DocumentoIntegrityService', () => {
  let service: DocumentoIntegrityService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentoIntegrityService],
    }).compile();

    service = module.get<DocumentoIntegrityService>(DocumentoIntegrityService);
  });

  // ─── computeHash ──────────────────────────────────────────────────────────

  describe('computeHash', () => {
    it('debe generar un hash SHA-256 de 64 caracteres hex', () => {
      const hash = service.computeHash(
        'doc-id-1',
        '2026-03-15T00:00:00.000Z',
        1500000,
        '12.345.678-9',
        'salt-secreto',
      );

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('debe producir el mismo hash para los mismos datos', () => {
      const hash1 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt',
      );
      const hash2 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt',
      );

      expect(hash1).toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia el monto', () => {
      const hash1 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt',
      );
      const hash2 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1001,
        '11.111.111-1',
        'salt',
      );

      expect(hash1).not.toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia la fecha', () => {
      const hash1 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt',
      );
      const hash2 = service.computeHash(
        'id',
        '2026-01-02T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt',
      );

      expect(hash1).not.toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia el RUT', () => {
      const hash1 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt',
      );
      const hash2 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1000,
        '22.222.222-2',
        'salt',
      );

      expect(hash1).not.toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia el salt', () => {
      const hash1 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt1',
      );
      const hash2 = service.computeHash(
        'id',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt2',
      );

      expect(hash1).not.toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia el ID', () => {
      const hash1 = service.computeHash(
        'id-1',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt',
      );
      const hash2 = service.computeHash(
        'id-2',
        '2026-01-01T00:00:00.000Z',
        1000,
        '11.111.111-1',
        'salt',
      );

      expect(hash1).not.toBe(hash2);
    });
  });

  // ─── generateQR ───────────────────────────────────────────────────────────

  describe('generateQR', () => {
    it('debe generar un QR como data URL base64', async () => {
      const result = await service.generateQR(
        'https://example.com/validar/uuid',
      );

      expect(result).toBe('data:image/png;base64,mocked-qr-data');
    });
  });

  // ─── generatePDFBuffer ─────────────────────────────────────────────────────

  describe('generatePDFBuffer', () => {
    const documentoBase = {
      titulo: 'Balance Anual 2026',
      descripcion: 'Balance financiero del CGPA',
      monto: 1500000,
      fecha_emision: new Date('2026-03-15'),
      rut_emisor: '12.345.678-9',
      estado: 'SELLADO' as const,
      creado_por: { uid: 'uid-admin', nombre: 'Admin' },
      fecha_creacion: new Date(),
      hash_integridad:
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      qr_base64: 'data:image/png;base64,qrFake',
    };

    beforeEach(() => {
      // Reiniciar el mock de pdfkit para cada test
      jest.clearAllMocks();
    });

    it('debe generar un buffer de PDF', async () => {
      const buffer = await service.generatePDFBuffer(documentoBase);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(PDFDocument).toHaveBeenCalled();
    });

    it('debe incluir el membrete del CGPA en el encabezado', async () => {
      await service.generatePDFBuffer(documentoBase);

      const mockDoc = (PDFDocument as jest.Mock).mock.results[0].value;

      // Verifica que se escribió el nombre de la organización
      const textCalls = (mockDoc.text as jest.Mock).mock.calls;
      const headerTexts = textCalls.map((call: any[]) => call[0]);

      expect(headerTexts).toContain(
        'CENTRO GENERAL DE PADRES Y APODERADOS',
      );
      expect(headerTexts).toContain('Liceo Alexander Graham Bell');
      expect(headerTexts).toContain('COMPROBANTE DIGITAL');
    });

    it('debe dibujar la tabla con los datos del documento', async () => {
      await service.generatePDFBuffer(documentoBase);

      const mockDoc = (PDFDocument as jest.Mock).mock.results[0].value;

      // Verifica que se usó rect() para dibujar la tabla (cabecera + 3 filas)
      expect(mockDoc.rect).toHaveBeenCalled();

      // Verifica que las filas contienen los datos esperados
      const textCalls = (mockDoc.text as jest.Mock).mock.calls;
      const allTexts = textCalls.map((call: any[]) => call[0]);

      // Etiquetas de la tabla
      expect(allTexts).toContain('Concepto');
      expect(allTexts).toContain('Valor');
      expect(allTexts).toContain('Monto');
      expect(allTexts).toContain('Fecha de Emisión');
      expect(allTexts).toContain('RUT Emisor');

      // Valores de la tabla
      expect(allTexts).toContain('$1.500.000');
      expect(allTexts).toContain('12.345.678-9');
    });

    it('debe incluir la línea decorativa del encabezado', async () => {
      await service.generatePDFBuffer(documentoBase);

      const mockDoc = (PDFDocument as jest.Mock).mock.results[0].value;

      // Verifica que se dibujó una línea decorativa
      expect(mockDoc.lineWidth).toHaveBeenCalledWith(2);
      expect(mockDoc.moveTo).toHaveBeenCalled();
      expect(mockDoc.lineTo).toHaveBeenCalled();
      expect(mockDoc.stroke).toHaveBeenCalledWith('#2c3e50');
    });

    it('debe dibujar la cabecera de la tabla con fondo oscuro', async () => {
      await service.generatePDFBuffer(documentoBase);

      const mockDoc = (PDFDocument as jest.Mock).mock.results[0].value;

      // Verifica el fondo de la cabecera
      const fillCalls = (mockDoc.fill as jest.Mock).mock.calls;
      expect(fillCalls).toContainEqual(['#2c3e50']);

      // Verifica texto blanco en la cabecera
      const fillColorCalls = (mockDoc.fillColor as jest.Mock).mock.calls;
      expect(fillColorCalls).toContainEqual(['#ffffff']);
    });

    it('debe rechazar si pdfkit emite error', async () => {
      const PDFDocumentModule = require('pdfkit').default;
      const mockDoc = PDFDocumentModule();

      const onMock = mockDoc.on as jest.Mock;
      onMock.mockImplementation(
        (event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'error') {
            cb(new Error('PDF error'));
          }
          return mockDoc;
        },
      );

      await expect(service.generatePDFBuffer(documentoBase)).rejects.toThrow(
        'PDF error',
      );
    });
  });
});
