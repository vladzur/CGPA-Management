import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { ACCESS_POLICY_KEY } from '../access/access.decorator';
import { createMockAuth } from '../../__mocks__/firebase-admin.mock';

jest.mock('firebase-admin', () => ({
  auth: jest.fn(),
}));

import * as admin from 'firebase-admin';

/**
 * Helper: crea un ExecutionContext mockeado que simula una request HTTP.
 */
function createMockExecutionContext(
  headers: Record<string, string> = {},
  handler: () => unknown = () => undefined,
): ExecutionContext {
  const request = { headers, user: undefined as any };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('FirebaseAuthGuard', () => {
  let guard: FirebaseAuthGuard;
  let mockAuth: ReturnType<typeof createMockAuth>;

  beforeEach(() => {
    mockAuth = createMockAuth();
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);
    guard = new FirebaseAuthGuard(new Reflector());
  });

  afterEach(() => jest.clearAllMocks());

  it('debe lanzar UnauthorizedException si no hay header Authorization', async () => {
    const ctx = createMockExecutionContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si el header no empieza con "Bearer "', async () => {
    const ctx = createMockExecutionContext({ authorization: 'Basic xyz' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si verifyIdToken rechaza el token', async () => {
    mockAuth.verifyIdToken.mockRejectedValue(new Error('Token expirado'));
    const ctx = createMockExecutionContext({
      authorization: 'Bearer invalid-token',
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('debe inyectar datos del usuario en req.user y retornar true en happy path', async () => {
    const decodedToken = {
      uid: 'uid-123',
      email: 'test@test.cl',
      name: 'Tester',
      role: 'ADMIN',
      activo: true,
      email_verified: true,
    };
    mockAuth.verifyIdToken.mockResolvedValue(decodedToken as any);

    const request = {
      headers: { authorization: 'Bearer valid-token' },
      user: undefined as any,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      uid: 'uid-123',
      email: 'test@test.cl',
      name: 'Tester',
      role: 'ADMIN',
      activo: true,
      email_verified: true,
    });

    // El segundo argumento exige comprobar la revocación del token.
    expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token', true);
  });

  it('debe usar email como name si name no está presente en el token', async () => {
    const decodedToken = {
      uid: 'uid-456',
      email: 'sin-nombre@test.cl',
      name: undefined,
      role: 'EDITOR',
      activo: true,
    };
    mockAuth.verifyIdToken.mockResolvedValue(decodedToken as any);

    const request = {
      headers: { authorization: 'Bearer valid-token-2' },
      user: undefined as any,
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    } as unknown as ExecutionContext;

    await guard.canActivate(ctx);

    expect(request.user.name).toBe('sin-nombre@test.cl');
  });

  it('debe ignorar el token en una ruta PUBLIC aunque no haya Authorization', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(ACCESS_POLICY_KEY, 'PUBLIC', handler);
    const ctx = createMockExecutionContext({}, handler);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(mockAuth.verifyIdToken).not.toHaveBeenCalled();
  });
});
