import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PasarelasService } from './pasarelas.service';
import { PASARELAS_PAGO, type PasarelaPago } from './pasarela-pago.interface';

function makePasarela(id: 'khipu', nombre = 'Khipu'): PasarelaPago {
  return {
    id,
    nombre,
    crearCobro: jest.fn(),
    extraerReferenciaNotificacion: jest.fn(),
    verificarPago: jest.fn(),
  };
}

describe('PasarelasService', () => {
  let service: PasarelasService;
  let khipu: PasarelaPago;

  beforeEach(async () => {
    khipu = makePasarela('khipu');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasarelasService,
        { provide: PASARELAS_PAGO, useValue: [khipu] },
      ],
    }).compile();

    service = module.get<PasarelasService>(PasarelasService);
  });

  it('should resolve a registered gateway by its identifier', () => {
    expect(service.obtener('khipu')).toBe(khipu);
  });

  it('should reject an unsupported gateway', () => {
    expect(() => service.obtener('transferencia-manual')).toThrow(
      BadRequestException,
    );
  });

  it('should describe the available gateway in the error message', () => {
    expect(() => service.obtener('webpay')).toThrow(
      'Método de pago no soportado: webpay',
    );
  });
});
