import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_POLICY_KEY, type AccessPolicy } from './access.decorator';

/**
 * Aplica la matriz de acceso declarada con `@Access`.
 *
 * Debe ejecutarse después de `FirebaseAuthGuard`, que valida el token e inyecta
 * `request.user`. Una ruta sin `@Access` se deniega siempre: el valor por defecto
 * es cerrar, no abrir.
 */
@Injectable()
export class AccessPolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<AccessPolicy>(
      ACCESS_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!policy) {
      throw new ForbiddenException(
        'La ruta no declara una política de acceso y fue denegada',
      );
    }

    if (policy === 'PUBLIC') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.uid) {
      throw new UnauthorizedException(
        'Token de autorización no proporcionado o inválido',
      );
    }

    if (policy === 'AUTHENTICATED') {
      return true;
    }

    // policy === 'ADMIN'
    if (user.role !== 'ADMIN' || user.activo !== true) {
      throw new ForbiddenException(
        'Se requiere una cuenta de administrador activa para esta operación',
      );
    }

    return true;
  }
}
