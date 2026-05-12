import { Test, TestingModule } from '@nestjs/testing';
import { DocumentoIntegrityService } from './documento-integrity.service';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mocked-qr-data'),
}));

jest.mock('pdfkit', () => {
  const mockDoc = {
    on: jest.fn(),
    font: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    end: jest.fn(),
    page: { height: 842, width: 595 },
  };

  const PDFDocument = jest.fn(() => mockDoc);

  return {
    __esModule: true,
    default: PDFDocument,
  };
});

describe('DocumentoIntegrityService', () => {
  let service: DocumentoIntegrityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentoIntegrityService],
    }).compile();

    service = module.get<DocumentoIntegrityService>(DocumentoIntegrityService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      const hash1 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt');
      const hash2 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt');

      expect(hash1).toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia el monto', () => {
      const hash1 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt');
      const hash2 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1001, '11.111.111-1', 'salt');

      expect(hash1).not.toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia la fecha', () => {
      const hash1 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt');
      const hash2 = service.computeHash('id', '2026-01-02T00:00:00.000Z', 1000, '11.111.111-1', 'salt');

      expect(hash1).not.toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia el RUT', () => {
      const hash1 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt');
      const hash2 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1000, '22.222.222-2', 'salt');

      expect(hash1).not.toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia el salt', () => {
      const hash1 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt1');
      const hash2 = service.computeHash('id', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt2');

      expect(hash1).not.toBe(hash2);
    });

    it('debe producir hashes diferentes si cambia el ID', () => {
      const hash1 = service.computeHash('id-1', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt');
      const hash2 = service.computeHash('id-2', '2026-01-01T00:00:00.000Z', 1000, '11.111.111-1', 'salt');

      expect(hash1).not.toBe(hash2);
    });
  });

  // ─── generateQR ───────────────────────────────────────────────────────────

  describe('generateQR', () => {
    it('debe generar un QR como data URL base64', async () => {
      const result = await service.generateQR('https://example.com/validar/uuid');

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
      hash_integridad: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      qr_base64: 'data:image/png;base64,qrFake',
    };

    it('debe generar un buffer de PDF', async () => {
      const PDFDocument = require('pdfkit').default;
      const mockDoc = PDFDocument();

      // Simular el evento 'end' que pasa el buffer
      const mockBuffer = Buffer.from('fake-pdf-content');
      const onMock = mockDoc.on as jest.Mock;
      onMock.mockImplementation((event: string, cb: Function) => {
        if (event === 'data') {
          cb(mockBuffer);
        }
        if (event === 'end') {
          cb();
        }
        return mockDoc;
      });

      const buffer = await service.generatePDFBuffer(documentoBase);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(PDFDocument).toHaveBeenCalled();
    });

    it('debe rechazar si pdfkit emite error', async () => {
      const PDFDocument = require('pdfkit').default;
      const mockDoc = PDFDocument();

      const onMock = mockDoc.on as jest.Mock;
      onMock.mockImplementation((event: string, cb: Function) => {
        if (event === 'error') {
          cb(new Error('PDF error'));
        }
        return mockDoc;
      });

      await expect(service.generatePDFBuffer(documentoBase)).rejects.toThrow('PDF error');
    });
  });
});
