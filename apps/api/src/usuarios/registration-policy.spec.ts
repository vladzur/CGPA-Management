import { isRegistrationEnabled } from './registration-policy';

describe('isRegistrationEnabled', () => {
  it('should keep registration closed when the flag is absent', () => {
    expect(isRegistrationEnabled({})).toBe(false);
  });

  it('should only open registration for explicit true values', () => {
    expect(isRegistrationEnabled({ REGISTRO_HABILITADO: 'true' })).toBe(true);
    expect(isRegistrationEnabled({ REGISTRO_HABILITADO: '1' })).toBe(true);
  });

  it('should reject any other value', () => {
    for (const value of ['false', '0', 'TRUE', 'yes', '']) {
      expect(isRegistrationEnabled({ REGISTRO_HABILITADO: value })).toBe(false);
    }
  });
});
