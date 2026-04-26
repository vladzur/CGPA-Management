import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from './zod-validation.pipe';
import { z } from 'zod';

// Schema de prueba
const TestSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  monto: z.coerce.number().positive('El monto debe ser positivo'),
  tag: z.string().optional(),
});

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(TestSchema);
  });

  it('debe retornar el valor parseado cuando los datos son válidos', () => {
    const input = { nombre: 'Test', monto: '150' }; // monto como string → coerce
    const result = pipe.transform(input, { type: 'body' });
    expect(result).toEqual({ nombre: 'Test', monto: 150 });
  });

  it('debe incluir campos opcionales si se proveen', () => {
    const input = { nombre: 'Test', monto: 50, tag: 'urgente' };
    const result = pipe.transform(input, { type: 'body' });
    expect(result).toHaveProperty('tag', 'urgente');
  });

  it('debe omitir el campo opcional si no se provee', () => {
    const input = { nombre: 'Test', monto: 50 };
    const result = pipe.transform(input, { type: 'body' });
    expect(result).not.toHaveProperty('tag');
  });

  it('debe lanzar BadRequestException con errores formateados cuando Zod falla', () => {
    const input = { nombre: '', monto: -5 };
    expect(() => pipe.transform(input, { type: 'body' })).toThrow(BadRequestException);

    try {
      pipe.transform(input, { type: 'body' });
    } catch (err: any) {
      expect(err.response).toHaveProperty('message', 'Error de validación de datos');
      expect(err.response).toHaveProperty('errors');
      expect(Array.isArray(err.response.errors)).toBe(true);
      // Debe incluir mensajes de error de Zod formateados
      const errorsText = err.response.errors.join(' ');
      expect(errorsText).toContain('monto');
    }
  });

  it('debe lanzar BadRequestException con mensaje genérico ante error no-Zod', () => {
    // Schema que lanza un error no-Zod
    const brokenSchema = {
      parse: () => { throw new Error('Error inesperado'); },
    };
    const brokenPipe = new ZodValidationPipe(brokenSchema as any);

    expect(() => brokenPipe.transform({}, { type: 'body' })).toThrow(BadRequestException);
    try {
      brokenPipe.transform({}, { type: 'body' });
    } catch (err: any) {
      expect(err.message).toContain('Fallo en la validación');
    }
  });

  it('debe lanzar BadRequestException cuando faltan campos requeridos', () => {
    const input = {}; // falta nombre y monto
    expect(() => pipe.transform(input, { type: 'body' })).toThrow(BadRequestException);
  });
});
