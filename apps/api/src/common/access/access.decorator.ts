import { SetMetadata } from '@nestjs/common';

/** Metadato que declara la política de acceso de una ruta. */
export const ACCESS_POLICY_KEY = 'access_policy';

/**
 * Políticas de acceso de la API.
 *
 * - `PUBLIC`: sin token; no debe devolver datos internos.
 * - `AUTHENTICATED`: token válido, aunque la cuenta esté pendiente de aprobación.
 * - `ADMIN`: token válido, cuenta activa y rol `ADMIN`.
 */
export type AccessPolicy = 'PUBLIC' | 'AUTHENTICATED' | 'ADMIN';

/**
 * Declara la política de acceso de una ruta.
 *
 * Toda ruta debe declararla. `AccessPolicyGuard` deniega con `403` las rutas sin
 * metadato para que una omisión no abra un endpoint por accidente.
 */
export const Access = (policy: AccessPolicy) =>
  SetMetadata(ACCESS_POLICY_KEY, policy);
