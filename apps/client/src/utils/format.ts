/**
 * Utilidades de formato compartidas por las vistas públicas y el panel de administración.
 * Centralizarlas evita que cada vista reimplemente la conversión de timestamps de
 * Firestore y el formato de moneda chilena.
 */

/** Convierte un timestamp de Firestore (o cualquier valor asimilable) a `Date`. */
export function toDate(value: unknown): Date | null {
  if (!value) return null;

  const candidate = value as { toDate?: () => Date; _seconds?: number };

  if (typeof candidate.toDate === 'function') return candidate.toDate();
  if (typeof candidate._seconds === 'number') {
    return new Date(candidate._seconds * 1000);
  }

  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Formatea un monto en pesos chilenos, por ejemplo `$1.250.000`. */
export function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

/** Formatea una fecha larga en español, por ejemplo `05 de mayo de 2026`. */
export function formatDate(value: unknown): string {
  const date = toDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Formatea fecha y hora, usado en el sello de última actualización. */
export function formatDateTime(value: unknown): string {
  const date = toDate(value);
  if (!date) return 'No disponible';

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Calcula el porcentaje de ejecución presupuestaria de un proyecto. */
export function executionPercentage(
  executed: number | null | undefined,
  budget: number | null | undefined,
): number {
  if (!budget || budget <= 0) return 0;
  return Math.round(((executed ?? 0) / budget) * 100);
}
