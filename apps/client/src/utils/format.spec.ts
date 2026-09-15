import { describe, expect, it } from 'vitest';
import {
  executionPercentage,
  formatCurrency,
  formatDate,
  formatDateTime,
  toDate,
} from './format';

describe('format utilities', () => {
  describe('toDate', () => {
    it('should return null for empty values', () => {
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
      expect(toDate('')).toBeNull();
    });

    it('should convert a value exposing toDate, like a Firestore Timestamp', () => {
      const date = new Date('2026-08-01T10:00:00Z');
      expect(toDate({ toDate: () => date })?.toISOString()).toBe(
        date.toISOString(),
      );
    });

    it('should convert the serialized _seconds representation', () => {
      const seconds = 1785000000;
      expect(toDate({ _seconds: seconds })?.getTime()).toBe(seconds * 1000);
    });

    it('should parse an ISO string', () => {
      expect(toDate('2026-08-01T10:00:00Z')?.toISOString()).toBe(
        '2026-08-01T10:00:00.000Z',
      );
    });

    it('should return null for an unparseable string', () => {
      expect(toDate('no-es-una-fecha')).toBeNull();
    });
  });

  describe('formatCurrency', () => {
    it('should format an amount in chilean pesos', () => {
      expect(formatCurrency(1250000)).toContain('1.250.000');
    });

    it('should treat missing amounts as zero', () => {
      expect(formatCurrency(null)).toBe(formatCurrency(0));
      expect(formatCurrency(undefined)).toBe(formatCurrency(0));
    });
  });

  describe('formatDate', () => {
    it('should format a long date in spanish', () => {
      expect(formatDate(new Date('2026-05-05T12:00:00Z'))).toMatch(
        /mayo de 2026/,
      );
    });

    it('should return an empty string for missing values', () => {
      expect(formatDate(null)).toBe('');
    });
  });

  describe('formatDateTime', () => {
    it('should describe an unavailable timestamp', () => {
      expect(formatDateTime(null)).toBe('No disponible');
    });

    it('should format date and time including the year', () => {
      expect(formatDateTime(new Date('2026-05-05T12:00:00Z'))).toMatch(/2026/);
    });
  });

  describe('executionPercentage', () => {
    it('should compute the executed share of the budget', () => {
      expect(executionPercentage(250000, 1000000)).toBe(25);
    });

    it('should report over-execution above one hundred percent', () => {
      expect(executionPercentage(1500000, 1000000)).toBe(150);
    });

    it('should avoid dividing by zero when no budget is declared', () => {
      expect(executionPercentage(500000, 0)).toBe(0);
      expect(executionPercentage(500000, null)).toBe(0);
    });

    it('should treat a missing executed amount as zero', () => {
      expect(executionPercentage(null, 1000000)).toBe(0);
    });
  });
});
