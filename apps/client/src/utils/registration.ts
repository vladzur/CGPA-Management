/**
 * Política de registro del sitio.
 *
 * Debe reflejar `REGISTRO_HABILITADO` del backend (`VITE_REGISTRO_HABILITADO`).
 * Si la variable no existe o no vale `true`/`1`, el formulario queda cerrado y
 * se muestra el aviso de invitación.
 */
export function isRegistrationEnabled(): boolean {
  const raw = import.meta.env.VITE_REGISTRO_HABILITADO;

  return raw === 'true' || raw === '1';
}
