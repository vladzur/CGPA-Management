/**
 * Validación y armado del formulario del botón de pago.
 *
 * Se mantiene fuera de la vista para poder probar las reglas sin montar el
 * componente y para que el payload enviado al backend sea siempre el mismo.
 * No depende de la pasarela concreta.
 */
import {
  CUOTA_ANUAL_MONTO_SUGERIDO,
  CUOTA_ANUAL_PERIODO,
  DONACION_MONTO_SUGERIDO,
  PAGO_MONTO_MAXIMO,
  PAGO_MONTO_MINIMO,
  type TipoAporte,
} from '@cgpa/shared';

export interface PagoForm {
  nombre: string;
  email: string;
  tipoAporte: TipoAporte;
  monto: string;
  estudiante: string;
}

export type PagoFormErrors = Partial<Record<keyof PagoForm, string>>;

/** Payload que espera `POST /pagos/:proveedor`. */
export interface PagoPayload {
  tipo_aporte: TipoAporte;
  monto: number;
  pagador_email: string;
  pagador_nombre: string;
  estudiante?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Tipo de aporte que se ofrece preseleccionado. */
export const PAGO_TIPO_APORTE_PREDETERMINADO: TipoAporte = 'CUOTA_ANUAL';

/** Concepto de la cuota vigente, usado por los textos de la página. */
export const PAGO_CONCEPTO_PREDETERMINADO = `Cuota anual ${CUOTA_ANUAL_PERIODO}`;

/** Montos sugeridos que el pagador puede modificar. */
export const PAGO_MONTO_PREDETERMINADO = String(CUOTA_ANUAL_MONTO_SUGERIDO);
export const PAGO_MONTO_DONACION_PREDETERMINADO = String(
  DONACION_MONTO_SUGERIDO,
);

export function createEmptyPagoForm(): PagoForm {
  return {
    nombre: '',
    email: '',
    tipoAporte: PAGO_TIPO_APORTE_PREDETERMINADO,
    monto: '',
    estudiante: '',
  };
}

/** Formulario con los valores sugeridos que el pagador puede modificar. */
export function createDefaultPagoForm(): PagoForm {
  return {
    ...createEmptyPagoForm(),
    monto: PAGO_MONTO_PREDETERMINADO,
  };
}

/** Monto sugerido según el tipo de aporte elegido. */
export function montoSugeridoPara(tipo: TipoAporte): string {
  return tipo === 'CUOTA_ANUAL'
    ? PAGO_MONTO_PREDETERMINADO
    : PAGO_MONTO_DONACION_PREDETERMINADO;
}

export function validatePagoForm(form: PagoForm): PagoFormErrors {
  const errors: PagoFormErrors = {};

  if (form.nombre.trim().length < 3) {
    errors.nombre = 'Indica tu nombre completo.';
  }

  if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  if (
    form.tipoAporte === 'CUOTA_ANUAL' &&
    form.estudiante.trim().length > 120
  ) {
    errors.estudiante = 'El estudiante o curso es demasiado largo.';
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
  const payload: PagoPayload = {
    tipo_aporte: form.tipoAporte,
    monto: Number(form.monto.trim()),
    pagador_email: form.email.trim(),
    pagador_nombre: form.nombre.trim(),
  };

  if (form.tipoAporte === 'CUOTA_ANUAL' && form.estudiante.trim()) {
    payload.estudiante = form.estudiante.trim();
  }

  return payload;
}

/** Redirige al portal de pago. Aislado para poder simularlo en los tests. */
export function redirectToPaymentPortal(url: string): void {
  window.location.assign(url);
}
