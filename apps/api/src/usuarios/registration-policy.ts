/**
 * Política de contención del registro público.
 *
 * Mientras la directiva no apruebe la política definitiva (RN-05), el registro
 * queda cerrado por defecto. Solo se abre cuando `REGISTRO_HABILITADO` vale
 * exactamente `true` o `1`, de modo que una variable ausente nunca habilite
 * creación de cuentas.
 */
export function isRegistrationEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.REGISTRO_HABILITADO;

  return raw === 'true' || raw === '1';
}
