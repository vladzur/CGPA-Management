import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRegistrationEnabled } from './registration';

describe('isRegistrationEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should keep registration closed without the flag', () => {
    expect(isRegistrationEnabled()).toBe(false);
  });

  it('should open registration only for explicit true values', () => {
    vi.stubEnv('VITE_REGISTRO_HABILITADO', 'true');
    expect(isRegistrationEnabled()).toBe(true);

    vi.stubEnv('VITE_REGISTRO_HABILITADO', '1');
    expect(isRegistrationEnabled()).toBe(true);
  });

  it('should reject other values', () => {
    for (const value of ['false', '0', 'TRUE', 'yes', '']) {
      vi.stubEnv('VITE_REGISTRO_HABILITADO', value);
      expect(isRegistrationEnabled()).toBe(false);
    }
  });
});
