import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

/** Helper: crea un ExecutionContext mockeado con el usuario ya inyectado. */
function createMockExecutionContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('should allow an active administrator', () => {
    const ctx = createMockExecutionContext({ role: 'ADMIN', activo: true });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should reject a request without an authenticated user', () => {
    const ctx = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should reject users without the admin role', () => {
    for (const role of ['APODERADO', 'TESORERO', 'PENDIENTE', undefined]) {
      const ctx = createMockExecutionContext({ role, activo: true });

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    }
  });

  it('should reject an administrator whose account is not active', () => {
    const inactive = createMockExecutionContext({ role: 'ADMIN', activo: false });
    const pending = createMockExecutionContext({ role: 'ADMIN' });

    expect(() => guard.canActivate(inactive)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(pending)).toThrow(ForbiddenException);
  });
});
