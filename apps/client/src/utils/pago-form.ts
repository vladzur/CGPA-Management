/**
 * Validación y armado del formulario del botón de pago.
 *
 * Se mantiene fuera de la vista para poder probar las reglas sin montar el
 * componente y para que el payload enviado al backend sea siempre el mismo.
 * No depende de la pasarela concreta.
 */
import { PAGO_MONTO_MAXIMO, PAGO_MONTO_MINIMO } from '@cgpa/shared';

export interface PagoForm {
  nombre: string;
  email: string;
  concepto: string;
  monto: string;
}

export type PagoFormErrors = Partial<Record<keyof PagoForm, string>>;

/** Payload que espera `POST /pagos/:proveedor`. */
export interface PagoPayload {
  concepto: string;
  monto: number;
  pagador_email: string;
  pagador_nombre: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Concepto y monto de la cuota vigente que se ofrecen por defecto. */
export const PAGO_CONCEPTO_PREDETERMINADO = 'Cuota anual 2027';
export const PAGO_MONTO_PREDETERMINADO = '10000';

export function createEmptyPagoForm(): PagoForm {
  return {
    nombre: '',
    email: '',
    concepto: '',
    monto: '',
  };
}

/** Formulario con los valores sugeridos que el apoderado puede modificar. */
export function createDefaultPagoForm(): PagoForm {
  return {
    ...createEmptyPagoForm(),
    concepto: PAGO_CONCEPTO_PREDETERMINADO,
    monto: PAGO_MONTO_PREDETERMINADO,
  };
}

export function validatePagoForm(form: PagoForm): PagoFormErrors {
  const errors: PagoFormErrors = {};

  if (form.nombre.trim().length < 3) {
    errors.nombre = 'Indica tu nombre completo.';
  }

  if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  if (form.concepto.trim().length < 3) {
    errors.concepto = 'Indica el motivo del pago.';
  }

  const montoNormalizado = form.monto.trim();

  if (!/^\d+$/.test(montoNormalizado)) {
    errors.monto = 'Ingresa el monto en pesos, sin puntos ni decimales.';
  } else {
    const monto = Number(montoNormalizado);

    if (monto < PAGO_MONTO_MINIMO) {
      errors.monto = `El monto mínimo es de $${PAGO_MONTO_MINIMO}.`;
    } else if (monto > PAGO_MONTO_MAXIMO) {
      errors.monto = `El monto máximo es de $${PAGO_MONTO_MAXIMO}.`;
    }
  }

  return errors;
}

export function buildPagoPayload(form: PagoForm): PagoPayload {
  return {
    concepto: form.concepto.trim(),
    monto: Number(form.monto.trim()),
    pagador_email: form.email.trim(),
    pagador_nombre: form.nombre.trim(),
  };
}

/** Redirige al portal de pago. Aislado para poder simularlo en los tests. */
export function redirectToPaymentPortal(url: string): void {
  window.location.assign(url);
}
