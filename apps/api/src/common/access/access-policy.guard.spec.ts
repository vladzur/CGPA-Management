import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessPolicyGuard } from './access-policy.guard';
import { ACCESS_POLICY_KEY, type AccessPolicy } from './access.decorator';

/** Helper: crea un contexto con la política y el usuario indicados. */
function createContext(
  policy: AccessPolicy | undefined,
  user: unknown,
): ExecutionContext {
  const handler = () => undefined;
  if (policy) {
    Reflect.defineMetadata(ACCESS_POLICY_KEY, policy, handler);
  }

  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('AccessPolicyGuard', () => {
  let guard: AccessPolicyGuard;

  beforeEach(() => {
    guard = new AccessPolicyGuard(new Reflector());
  });

  it('should allow a PUBLIC route without a user', () => {
    expect(guard.canActivate(createContext('PUBLIC', undefined))).toBe(true);
  });

  it('should deny a route without an access policy', () => {
    expect(() =>
      guard.canActivate(createContext(undefined, undefined)),
    ).toThrow(ForbiddenException);
  });

  it('should allow AUTHENTICATED for a valid token even if the account is pending', () => {
    expect(
      guard.canActivate(
        createContext('AUTHENTICATED', {
          uid: 'uid-pending',
          role: 'PENDIENTE',
          activo: false,
        }),
      ),
    ).toBe(true);
  });

  it('should reject AUTHENTICATED without an authenticated user', () => {
    expect(() => guard.canActivate(createContext('AUTHENTICATED', {}))).toThrow(
      UnauthorizedException,
    );
  });

  it('should allow ADMIN only for an active administrator', () => {
    expect(
      guard.canActivate(
        createContext('ADMIN', {
          uid: 'uid-admin',
          role: 'ADMIN',
          activo: true,
        }),
      ),
    ).toBe(true);
  });

  it('should reject ADMIN for inactive accounts, other roles and missing users', () => {
    for (const user of [
      { uid: 'uid-admin', role: 'ADMIN', activo: false },
      { uid: 'uid-admin', role: 'ADMIN' },
      { uid: 'uid-apoderado', role: 'APODERADO', activo: true },
      { uid: 'uid-tesorero', role: 'TESORERO', activo: true },
    ]) {
      expect(() => guard.canActivate(createContext('ADMIN', user))).toThrow(
        ForbiddenException,
      );
    }
  });

  it('should reject ADMIN without an authenticated user as unauthorized', () => {
    expect(() => guard.canActivate(createContext('ADMIN', {}))).toThrow(
      UnauthorizedException,
    );
  });
});
