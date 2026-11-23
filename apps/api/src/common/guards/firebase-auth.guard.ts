import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as admin from 'firebase-admin';
import {
  ACCESS_POLICY_KEY,
  type AccessPolicy,
} from '../access/access.decorator';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<AccessPolicy>(
      ACCESS_POLICY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Las rutas públicas (QR, transparencia, contacto) no exigen token.
    if (policy === 'PUBLIC') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Token de autorización no proporcionado o inválido',
      );
    }

    const token = authHeader.split('Bearer ')[1];

    try {
      // El segundo argumento comprueba revocación: un token de una cuenta
      // desactivada, con rol cambiado o eliminada deja de ser válido.
      const decodedToken = await admin.auth().verifyIdToken(token, true);

      // Inject user information into request object
      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email,
        role: decodedToken.role,
        activo: decodedToken.activo,
        email_verified: decodedToken.email_verified === true,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
