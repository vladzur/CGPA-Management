import { describe, expect, it } from 'vitest';
import {
  buildContactPayload,
  createEmptyContactForm,
  isLikelyEmail,
  isSpamSubmission,
  validateContactForm,
  type ContactFormValues,
} from './contact-form';

function makeForm(overrides: Partial<ContactFormValues> = {}): ContactFormValues {
  return {
    nombre: 'Ana Apoderada',
    email: 'ana@example.cl',
    telefono: '+56911112222',
    motivo: 'CUOTAS_Y_PAGOS',
    mensaje: 'Consulta sobre el pago de la cuota anual.',
    aceptaPrivacidad: true,
    sitioWeb: '',
    ...overrides,
  };
}

describe('contact form logic', () => {
  describe('createEmptyContactForm', () => {
    it('should default to a general enquiry without consent', () => {
      const form = createEmptyContactForm();

      expect(form.motivo).toBe('CONSULTA_GENERAL');
      expect(form.aceptaPrivacidad).toBe(false);
      expect(form.nombre).toBe('');
      expect(form.sitioWeb).toBe('');
    });
  });

  describe('isLikelyEmail', () => {
    it('should accept a well formed address', () => {
      expect(isLikelyEmail('apoderado@liceo.cl')).toBe(true);
      expect(isLikelyEmail('  nombre.apellido@example.com  ')).toBe(true);
    });

    it('should reject addresses without an at sign or with more than one', () => {
      expect(isLikelyEmail('apoderado.liceo.cl')).toBe(false);
      expect(isLikelyEmail('a@b@c.cl')).toBe(false);
    });

    it('should reject addresses without a valid domain', () => {
      expect(isLikelyEmail('apoderado@liceo')).toBe(false);
      expect(isLikelyEmail('apoderado@.cl')).toBe(false);
      expect(isLikelyEmail('apoderado@liceo.')).toBe(false);
    });

    it('should reject addresses containing whitespace', () => {
      expect(isLikelyEmail('apoderado @liceo.cl')).toBe(false);
      expect(isLikelyEmail('')).toBe(false);
    });
  });

  describe('validateContactForm', () => {
    it('should return no errors for a valid form', () => {
      expect(validateContactForm(makeForm())).toEqual({});
    });

    it('should require a full name', () => {
      const errors = validateContactForm(makeForm({ nombre: ' Al ' }));
      expect(errors.nombre).toBeDefined();
    });

    it('should require a valid email', () => {
      const errors = validateContactForm(makeForm({ email: 'invalido' }));
      expect(errors.email).toBeDefined();
    });

    it('should require a meaningful message', () => {
      const errors = validateContactForm(makeForm({ mensaje: 'Hola' }));
      expect(errors.mensaje).toBeDefined();
    });

    it('should require the privacy consent', () => {
      const errors = validateContactForm(makeForm({ aceptaPrivacidad: false }));
      expect(errors.aceptaPrivacidad).toBeDefined();
    });

    it('should report every problem at once', () => {
      const errors = validateContactForm(
        makeForm({
          nombre: '',
          email: '',
          mensaje: '',
          aceptaPrivacidad: false,
        }),
      );

      expect(Object.keys(errors).sort()).toEqual([
        'aceptaPrivacidad',
        'email',
        'mensaje',
        'nombre',
      ]);
    });
  });

  describe('isSpamSubmission', () => {
    it('should flag submissions that filled the honeypot field', () => {
      expect(isSpamSubmission(makeForm({ sitioWeb: 'http://spam.example' }))).toBe(
        true,
      );
    });

    it('should accept submissions with an untouched honeypot field', () => {
      expect(isSpamSubmission(makeForm())).toBe(false);
      expect(isSpamSubmission(makeForm({ sitioWeb: '   ' }))).toBe(false);
    });
  });

  describe('buildContactPayload', () => {
    it('should trim the text fields', () => {
      const payload = buildContactPayload(
        makeForm({ nombre: '  Ana Apoderada  ', email: ' ana@example.cl ' }),
      );

      expect(payload.nombre).toBe('Ana Apoderada');
      expect(payload.email).toBe('ana@example.cl');
    });

    it('should omit the phone number when it is empty', () => {
      const payload = buildContactPayload(makeForm({ telefono: '   ' }));

      expect(payload).not.toHaveProperty('telefono');
    });

    it('should include the phone number when it is provided', () => {
      const payload = buildContactPayload(makeForm());

      expect(payload.telefono).toBe('+56911112222');
    });

    it('should keep the selected reason', () => {
      expect(buildContactPayload(makeForm()).motivo).toBe('CUOTAS_Y_PAGOS');
    });
  });
});
