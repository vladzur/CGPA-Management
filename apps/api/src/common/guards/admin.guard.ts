import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Restringe una ruta a los usuarios con rol `ADMIN` y la cuenta activa.
 *
 * Debe declararse después de `FirebaseAuthGuard`, que es quien valida el token
 * e inyecta `request.user` con los custom claims del usuario.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user?.role !== 'ADMIN' || user?.activo !== true) {
      throw new ForbiddenException(
        'Se requiere una cuenta de administrador activa para esta operación',
      );
    }

    return true;
  }
}
