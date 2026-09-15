/**
 * Utilidades de soporte para el prerender estático.
 * Ver `apps/client/scripts/prerender.mjs`.
 */

interface PrerenderWindow {
  __PRERENDER_READY__?: boolean;
}

/**
 * Marca la página como lista para ser capturada.
 * El script de prerender espera esta señal antes de guardar el HTML estático de la ruta,
 * de modo que no se capture una vista a medio renderizar.
 */
export function signalPrerenderReady(): void {
  (window as unknown as PrerenderWindow).__PRERENDER_READY__ = true;
}
