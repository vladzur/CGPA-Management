import { describe, expect, it } from 'vitest';
import { PAGO_MONTO_MAXIMO, PAGO_MONTO_MINIMO } from '@cgpa/shared';
import {
  PAGO_CONCEPTO_PREDETERMINADO,
  PAGO_MONTO_PREDETERMINADO,
  buildPagoPayload,
  createDefaultPagoForm,
  createEmptyPagoForm,
  validatePagoForm,
} from './pago-form';

function validForm() {
  return {
    nombre: 'Juan Pérez',
    email: 'apoderado@ejemplo.cl',
    concepto: 'Cuota anual 2026',
    monto: '25000',
  };
}

describe('payment form', () => {
  it('should start with every field empty', () => {
    expect(createEmptyPagoForm()).toEqual({
      nombre: '',
      email: '',
      concepto: '',
      monto: '',
    });
  });

  it('should prefill the current annual fee for the payer', () => {
    expect(createDefaultPagoForm()).toEqual({
      nombre: '',
      email: '',
      concepto: 'Cuota anual 2027',
      monto: '10000',
    });
  });

  it('should expose the defaults as named constants', () => {
    expect(PAGO_CONCEPTO_PREDETERMINADO).toBe('Cuota anual 2027');
    expect(PAGO_MONTO_PREDETERMINADO).toBe('10000');
  });

  it('should accept the default form without validation errors', () => {
    const defaults = createDefaultPagoForm();

    expect(
      validatePagoForm({
        ...defaults,
        nombre: 'Juan Pérez',
        email: 'apoderado@ejemplo.cl',
      }),
    ).toEqual({});
  });

  it('should accept a complete valid form', () => {
    expect(validatePagoForm(validForm())).toEqual({});
  });

  it('should require a full name', () => {
    expect(validatePagoForm({ ...validForm(), nombre: '  ' })).toHaveProperty(
      'nombre',
    );
  });

  it('should require a valid email', () => {
    expect(
      validatePagoForm({ ...validForm(), email: 'no-es-un-correo' }),
    ).toHaveProperty('email');
  });

  it('should require a concept', () => {
    expect(
      validatePagoForm({ ...validForm(), concepto: ' ' }),
    ).toHaveProperty('concepto');
  });

  it('should reject a non numeric amount', () => {
    expect(
      validatePagoForm({ ...validForm(), monto: '25.000' }),
    ).toHaveProperty('monto');
  });

  it('should reject an amount below the minimum', () => {
    expect(
      validatePagoForm({
        ...validForm(),
        monto: String(PAGO_MONTO_MINIMO - 1),
      }),
    ).toHaveProperty('monto');
  });

  it('should reject an amount above the maximum', () => {
    expect(
      validatePagoForm({
        ...validForm(),
        monto: String(PAGO_MONTO_MAXIMO + 1),
      }),
    ).toHaveProperty('monto');
  });

  it('should trim the values when building the payload', () => {
    expect(
      buildPagoPayload({
        nombre: '  Juan Pérez ',
        email: ' apoderado@ejemplo.cl ',
        concepto: ' Cuota anual 2026 ',
        monto: ' 25000 ',
      }),
    ).toEqual({
      concepto: 'Cuota anual 2026',
      monto: 25000,
      pagador_email: 'apoderado@ejemplo.cl',
      pagador_nombre: 'Juan Pérez',
    });
  });
});
