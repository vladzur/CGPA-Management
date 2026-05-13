import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  createMockFirestore,
  createQuerySnapshot,
  createEmptyQuerySnapshot,
} from '../__mocks__/firebase-admin.mock';
import { LibroBalanceService } from './libro-balance.service';
import { DocumentosService } from '../documentos/documentos.service';

jest.mock('pdfkit', () => {
  const mockDoc = {
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
    end: jest.fn(),
    page: { height: 842, width: 595 },
    y: 50,
    addPage: jest.fn(),
  };

  const PDFDocument = jest.fn(() => mockDoc);

  return {
    __esModule: true,
    default: PDFDocument,
  };
});

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
}));

import * as admin from 'firebase-admin';

function buildTransaccion(overrides: Record<string, any> = {}) {
  return {
    tipo: 'INGRESO',
    monto: 50000,
    fecha: new Date('2026-03-03T12:00:00Z'),
    categoria: 'Cuotas',
    descripcion: 'Cuota marzo',
    registrado_por: { uid: 'user-1', nombre: 'Tesorero' },
    estado: 'CONCILIADO' as const,
    numero_secuencia: 1,
    hash_previo: null,
    hash_integridad: 'abc123',
    ...overrides,
  };
}

function createMockDocumentosService(
  overrides: Partial<DocumentosService> = {},
): DocumentosService {
  return {
    create: jest.fn().mockResolvedValue({
      id: 'doc-001',
      titulo: 'Libro de Balance',
    }),
    sellar: jest.fn().mockResolvedValue({
      id: 'doc-001',
      estado: 'SELLADO',
    }),
    findOne: jest.fn().mockResolvedValue({
      id: 'doc-001',
      titulo: 'Libro de Balance - Período 2026',
      descripcion: 'Balance 2026',
      monto: 100000,
      fecha_emision: new Date('2026-12-31T23:59:59Z'),
      rut_emisor: '12.345.678-9',
      estado: 'SELLADO',
      hash_integridad:
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      uuid_verificacion: '550e8400-e29b-41d4-a716-446655440000',
      qr_base64: 'data:image/png;base64,fakeQR',
      creado_por: { uid: 'user-1', nombre: 'Admin' },
      fecha_creacion: new Date('2026-05-12T18:00:00Z'),
    }),
    ...overrides,
  } as any as DocumentosService;
}

describe('LibroBalanceService', () => {
  let service: LibroBalanceService;
  let mockDocsService: DocumentosService;
  let mockFirestore: ReturnType<typeof createMockFirestore>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockFirestore = createMockFirestore();
    (admin.firestore as any).Timestamp = {
      now: jest.fn(() => new Date()),
      fromDate: jest.fn((d: Date) => d),
    };
    (admin.firestore as any).FieldValue = {
      serverTimestamp: jest.fn(() => '__serverTs__'),
    };
    (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

    mockDocsService = createMockDocumentosService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibroBalanceService,
        {
          provide: DocumentosService,
          useValue: mockDocsService,
        },
      ],
    }).compile();

    service = module.get<LibroBalanceService>(LibroBalanceService);
  });

  describe('generateBalanceBook', () => {
    const dtoBase = {
      periodo: '2026',
      rut_emisor: '12.345.678-9',
    };

    it('debe generar un PDF para un período anual completo', async () => {
      const txs = [
        buildTransaccion({
          tipo: 'INGRESO',
          monto: 150000,
          numero_secuencia: 1,
        }),
        buildTransaccion({
          tipo: 'EGRESO',
          monto: 50000,
          numero_secuencia: 2,
        }),
      ];

      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValue(
            createQuerySnapshot(
              txs.map((t, i) => ({ id: `tx-${i + 1}`, data: t })),
            ),
          ),
      };

      jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      const buffer = await service.generateBalanceBook(
        dtoBase,
        'user-1',
        'Admin',
      );

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(mockDocsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Libro de Balance - Período 2026',
          estado: 'BORRADOR',
        }),
        'user-1',
        'Admin',
      );
      expect(mockDocsService.sellar).toHaveBeenCalledWith(
        'doc-001',
        'user-1',
        'Admin',
      );
    });

    it('debe lanzar error si no hay transacciones en el período', async () => {
      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(createEmptyQuerySnapshot()),
      };

      jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      await expect(
        service.generateBalanceBook(dtoBase, 'user-1', 'Admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe filtrar por proyecto_id cuando se provee', async () => {
      const txs = [
        buildTransaccion({
          tipo: 'INGRESO',
          monto: 10000,
          numero_secuencia: 1,
          proyecto_id: 'proj-1',
        }),
      ];

      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValue(
            createQuerySnapshot(
              txs.map((t, i) => ({ id: `tx-${i + 1}`, data: t })),
            ),
          ),
      };

      const collectionStub = jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      await service.generateBalanceBook(
        { ...dtoBase, proyecto_id: 'proj-1' },
        'user-1',
        'Admin',
      );

      expect(collectionStub).toHaveBeenCalledWith('transacciones');
      const whereCalls = mockCollection.where.mock.calls;
      const proyectoFilter = whereCalls.find(
        (call: string[]) => call[0] === 'proyecto_id' && call[1] === '==',
      );
      expect(proyectoFilter).toBeDefined();
    });

    it('debe calcular totales correctamente', async () => {
      const txs = [
        buildTransaccion({
          tipo: 'INGRESO',
          monto: 100000,
          numero_secuencia: 1,
        }),
        buildTransaccion({
          tipo: 'INGRESO',
          monto: 50000,
          numero_secuencia: 2,
        }),
        buildTransaccion({ tipo: 'EGRESO', monto: 30000, numero_secuencia: 3 }),
        buildTransaccion({ tipo: 'EGRESO', monto: 20000, numero_secuencia: 4 }),
      ];

      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValue(
            createQuerySnapshot(
              txs.map((t, i) => ({ id: `tx-${i + 1}`, data: t })),
            ),
          ),
      };

      jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      await service.generateBalanceBook(dtoBase, 'user-1', 'Admin');

      const createCall = (mockDocsService.create as jest.Mock).mock.calls[0][0];
      expect(createCall.monto).toBe(100000); // 150000 ingresos - 50000 egresos
      expect(createCall.descripcion).toContain('150');
      expect(createCall.descripcion).toContain('50');
      expect(createCall.descripcion).toContain('100');
    });

    it('debe usar rango de fechas personalizado', async () => {
      const txs = [
        buildTransaccion({
          numero_secuencia: 1,
          fecha: new Date('2026-03-15T12:00:00Z'),
        }),
      ];

      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValue(
            createQuerySnapshot(
              txs.map((t, i) => ({ id: `tx-${i + 1}`, data: t })),
            ),
          ),
      };

      jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      await service.generateBalanceBook(
        {
          periodo: '2026',
          fecha_inicio: '2026-03-01T00:00:00.000Z',
          fecha_fin: '2026-03-31T23:59:59.999Z',
          rut_emisor: '12.345.678-9',
        },
        'user-1',
        'Admin',
      );

      const createCall = (mockDocsService.create as jest.Mock).mock.calls[0][0];
      expect(createCall.fecha_emision).toBeInstanceOf(Date);
    });

    it('debe usar título personalizado si se provee', async () => {
      const txs = [buildTransaccion({ numero_secuencia: 1 })];

      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValue(
            createQuerySnapshot(
              txs.map((t, i) => ({ id: `tx-${i + 1}`, data: t })),
            ),
          ),
      };

      jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      await service.generateBalanceBook(
        { ...dtoBase, titulo: 'Balance Primer Trimestre' },
        'user-1',
        'Admin',
      );

      const createCall = (mockDocsService.create as jest.Mock).mock.calls[0][0];
      expect(createCall.titulo).toBe('Balance Primer Trimestre');
    });

    it('debe usar RUT por defecto de variable de entorno si no se provee', async () => {
      const originalRut = process.env.CGPA_RUT;
      process.env.CGPA_RUT = '98.765.432-1';

      const txs = [buildTransaccion({ numero_secuencia: 1 })];

      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValue(
            createQuerySnapshot(
              txs.map((t, i) => ({ id: `tx-${i + 1}`, data: t })),
            ),
          ),
      };

      jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      try {
        await service.generateBalanceBook(
          { periodo: '2026' },
          'user-1',
          'Admin',
        );

        const createCall = (mockDocsService.create as jest.Mock).mock
          .calls[0][0];
        expect(createCall.rut_emisor).toBe('98.765.432-1');
      } finally {
        process.env.CGPA_RUT = originalRut;
      }
    });

    it('debe generar PDF con hash y QR en el pie de página', async () => {
      const txs = [
        buildTransaccion({
          tipo: 'INGRESO',
          monto: 50000,
          numero_secuencia: 1,
        }),
      ];

      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValue(
            createQuerySnapshot(
              txs.map((t, i) => ({ id: `tx-${i + 1}`, data: t })),
            ),
          ),
      };

      jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      const buffer = await service.generateBalanceBook(
        dtoBase,
        'user-1',
        'Admin',
      );

      expect(mockDocsService.findOne).toHaveBeenCalledWith('doc-001');
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('debe manejar muchas transacciones con paginación automática', async () => {
      const txs = Array.from({ length: 80 }, (_, i) =>
        buildTransaccion({
          tipo: i % 3 === 0 ? 'EGRESO' : 'INGRESO',
          monto: 10000 + i * 1000,
          numero_secuencia: i + 1,
          descripcion: `Transacción número ${i + 1}`,
        }),
      );

      const mockCollection = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        get: jest
          .fn()
          .mockResolvedValue(
            createQuerySnapshot(
              txs.map((t, i) => ({ id: `tx-${i + 1}`, data: t })),
            ),
          ),
      };

      jest
        .spyOn(mockFirestore, 'collection')
        .mockReturnValue(mockCollection as any);

      const buffer = await service.generateBalanceBook(
        dtoBase,
        'user-1',
        'Admin',
      );

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const createCall = (mockDocsService.create as jest.Mock).mock.calls[0][0];
      expect(createCall.descripcion).toContain('80');
    });
  });
});
