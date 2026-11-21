import { describe, expect, it } from 'vitest';
import { PAGO_MONTO_MAXIMO, PAGO_MONTO_MINIMO } from '@cgpa/shared';
import {
  PAGO_CONCEPTO_PREDETERMINADO,
  PAGO_MONTO_DONACION_PREDETERMINADO,
  PAGO_MONTO_PREDETERMINADO,
  PAGO_TIPO_APORTE_PREDETERMINADO,
  buildPagoPayload,
  createDefaultPagoForm,
  createEmptyPagoForm,
  montoSugeridoPara,
  validatePagoForm,
} from './pago-form';

function validForm() {
  return {
    nombre: 'Juan Pérez',
    email: 'apoderado@ejemplo.cl',
    tipoAporte: 'CUOTA_ANUAL' as const,
    monto: '25000',
    estudiante: '',
  };
}

describe('payment form', () => {
  it('should start with every text field empty and the annual fee selected', () => {
    expect(createEmptyPagoForm()).toEqual({
      nombre: '',
      email: '',
      tipoAporte: 'CUOTA_ANUAL',
      monto: '',
      estudiante: '',
    });
  });

  it('should prefill the suggested annual fee for the payer', () => {
    expect(createDefaultPagoForm()).toEqual({
      nombre: '',
      email: '',
      tipoAporte: 'CUOTA_ANUAL',
      monto: '10000',
      estudiante: '',
    });
  });

  it('should expose the defaults as named constants', () => {
    expect(PAGO_TIPO_APORTE_PREDETERMINADO).toBe('CUOTA_ANUAL');
    expect(PAGO_CONCEPTO_PREDETERMINADO).toBe('Cuota anual 2027');
    expect(PAGO_MONTO_PREDETERMINADO).toBe('10000');
    expect(PAGO_MONTO_DONACION_PREDETERMINADO).toBe('10000');
  });

  it('should suggest a different amount per payment type', () => {
    expect(montoSugeridoPara('CUOTA_ANUAL')).toBe('10000');
    expect(montoSugeridoPara('DONACION')).toBe('10000');
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

  it('should accept a valid donation with a free amount', () => {
    expect(
      validatePagoForm({
        ...validForm(),
        tipoAporte: 'DONACION',
        monto: '5000',
      }),
    ).toEqual({});
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

  it('should reject a student that is too long for the annual fee', () => {
    expect(
      validatePagoForm({
        ...validForm(),
        estudiante: 'x'.repeat(121),
      }),
    ).toHaveProperty('estudiante');
  });

  it('should ignore the student field for a donation', () => {
    expect(
      validatePagoForm({
        ...validForm(),
        tipoAporte: 'DONACION',
        estudiante: 'x'.repeat(121),
      }),
    ).toEqual({});
  });

  it('should build the annual fee payload with the trimmed student', () => {
    expect(
      buildPagoPayload({
        ...validForm(),
        nombre: '  Juan Pérez ',
        email: ' apoderado@ejemplo.cl ',
        monto: ' 25000 ',
        estudiante: '  3° Básico A  ',
      }),
    ).toEqual({
      tipo_aporte: 'CUOTA_ANUAL',
      monto: 25000,
      pagador_email: 'apoderado@ejemplo.cl',
      pagador_nombre: 'Juan Pérez',
      estudiante: '3° Básico A',
    });
  });

  it('should not send the student for a donation', () => {
    expect(
      buildPagoPayload({
        ...validForm(),
        tipoAporte: 'DONACION',
        monto: '5000',
        estudiante: '3° Básico A',
      }),
    ).toEqual({
      tipo_aporte: 'DONACION',
      monto: 5000,
      pagador_email: 'apoderado@ejemplo.cl',
      pagador_nombre: 'Juan Pérez',
    });
  });

  it('should omit an empty student from the annual fee payload', () => {
    expect(buildPagoPayload({ ...validForm(), estudiante: '   ' })).toEqual({
      tipo_aporte: 'CUOTA_ANUAL',
      monto: 25000,
      pagador_email: 'apoderado@ejemplo.cl',
      pagador_nombre: 'Juan Pérez',
    });
  });
});
