/**
 * Lógica del formulario de contacto, separada de la vista para poder probarla
 * sin montar el componente. La validación definitiva la aplica igualmente el
 * backend mediante el esquema Zod de `@cgpa/shared`.
 */

import type { MensajeMotivo } from '@cgpa/shared';

export interface ContactFormValues {
  nombre: string;
  email: string;
  telefono: string;
  motivo: MensajeMotivo;
  mensaje: string;
  aceptaPrivacidad: boolean;
  /** Campo trampa invisible: si llega con contenido, el envío es automatizado. */
  sitioWeb: string;
}

export type ContactFormErrors = Partial<
  Record<'nombre' | 'email' | 'mensaje' | 'aceptaPrivacidad', string>
>;

/** Cuerpo enviado al endpoint `POST /mensajes`. */
export interface ContactPayload {
  nombre: string;
  email: string;
  telefono?: string;
  motivo: MensajeMotivo;
  mensaje: string;
}

/**
 * Comprobación estructural de un correo electrónico.
 * Se evita una expresión regular con cuantificadores solapados para no exponer
 * al navegador a un retroceso (backtracking) costoso con entradas malformadas.
 */
export function isLikelyEmail(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0 || /\s/.test(trimmed)) return false;

  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf('@')) return false;

  const domain = trimmed.slice(atIndex + 1);
  const dotIndex = domain.indexOf('.');

  return dotIndex > 0 && dotIndex < domain.length - 1;
}

export function createEmptyContactForm(): ContactFormValues {
  return {
    nombre: '',
    email: '',
    telefono: '',
    motivo: 'CONSULTA_GENERAL',
    mensaje: '',
    aceptaPrivacidad: false,
    sitioWeb: '',
  };
}

/** Devuelve los errores visibles del formulario; vacío si es válido. */
export function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (values.nombre.trim().length < 3) {
    errors.nombre = 'Ingresa tu nombre completo (mínimo 3 caracteres).';
  }

  if (!isLikelyEmail(values.email)) {
    errors.email = 'Ingresa un correo electrónico válido.';
  }

  if (values.mensaje.trim().length < 10) {
    errors.mensaje = 'Cuéntanos tu consulta con un poco más de detalle (mínimo 10 caracteres).';
  }

  if (!values.aceptaPrivacidad) {
    errors.aceptaPrivacidad = 'Debes autorizar el uso de tus datos para poder responder.';
  }

  return errors;
}

/** Indica si el envío proviene de un bot que completó el campo trampa. */
export function isSpamSubmission(values: ContactFormValues): boolean {
  return values.sitioWeb.trim().length > 0;
}

/** Construye el cuerpo de la petición omitiendo los campos vacíos. */
export function buildContactPayload(values: ContactFormValues): ContactPayload {
  const telefono = values.telefono.trim();

  return {
    nombre: values.nombre.trim(),
    email: values.email.trim(),
    ...(telefono ? { telefono } : {}),
    motivo: values.motivo,
    mensaje: values.mensaje.trim(),
  };
}
