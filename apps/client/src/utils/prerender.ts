/**
 * Utilidades de soporte para el prerender estático.
 * Ver `apps/client/scripts/prerender.mjs`.
 */

interface PrerenderWindow {
  __PRERENDER_READY__?: boolean;
  /** Lo inyecta el servidor del script de prerender al entregar el HTML. */
  __PRERENDER__?: boolean;
  /** Estado ya resuelto que la página publica para que el prerender lo grabe. */
  __PRERENDER_STATE__?: unknown;
}

function prerenderWindow(): PrerenderWindow {
  return window as unknown as PrerenderWindow;
}

/**
 * Marca la página como lista para ser capturada.
 * El script de prerender espera esta señal antes de guardar el HTML estático de la ruta,
 * de modo que no se capture una vista a medio renderizar.
 */
export function signalPrerenderReady(): void {
  prerenderWindow().__PRERENDER_READY__ = true;
}

/** Indica que la página se está renderizando desde el script de prerender. */
export function isPrerenderMode(): boolean {
  return prerenderWindow().__PRERENDER__ === true;
}

/**
 * Publica el estado ya resuelto para que el prerender lo grabe en el HTML.
 * Fuera del prerender no hace nada, así que no hay costo en producción.
 */
export function publishPrerenderState(state: unknown): void {
  if (!isPrerenderMode()) return;
  prerenderWindow().__PRERENDER_STATE__ = state;
}

/**
 * Lee el estado que el HTML prerenderizado dejó disponible antes del montaje.
 * Devuelve `null` cuando no hay estado (servidor de desarrollo, sin prerender).
 */
export function readInitialState<T>(): T | null {
  // El estado viaja como JSON dentro de un script no ejecutable. Si el bloque
  // falta o está corrupto, la aplicación arranca sin estado inicial.
  const element = document.getElementById('__INITIAL_STATE__');
  if (!element?.textContent) return null;

  try {
    const state = JSON.parse(element.textContent);
    return state && typeof state === 'object' ? (state as T) : null;
  } catch {
    return null;
  }
}
