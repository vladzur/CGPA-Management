/**
 * Gestión de las etiquetas del `<head>` para cada página pública del sitio.
 *
 * Se aplica de forma sincrónica durante el setup del componente (no en
 * `onMounted`) para que el script de prerender capture el título, la descripción
 * y el canonical definitivos de cada ruta en el HTML estático.
 */

import { ORGANIZATION } from '../content/institutional';
import { PUBLIC_ROUTES, type PublicRouteName } from '../content/public-routes';

/** Imagen usada por defecto en las tarjetas de Open Graph y Twitter. */
export const DEFAULT_OG_IMAGE = `${ORGANIZATION.siteUrl}/og-image.png`;

/** URL base del sitio sin la barra final, para concatenar rutas. */
const SITE_BASE_URL = ORGANIZATION.siteUrl.endsWith('/')
  ? ORGANIZATION.siteUrl.slice(0, -1)
  : ORGANIZATION.siteUrl;

/** URL absoluta y canónica de una página pública. */
export function toCanonicalUrl(path: string): string {
  return path === '/' ? `${SITE_BASE_URL}/` : `${SITE_BASE_URL}${path}`;
}

function upsertMeta(
  attribute: 'name' | 'property',
  key: string,
  content: string,
): void {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let element =
    document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
}

/**
 * Aplica los metadatos de una página pública identificada por el nombre de su ruta.
 * Si el nombre no existe en la lista canónica, no modifica el documento y avisa por consola.
 */
export function usePageMeta(routeName: PublicRouteName): void {
  const route = PUBLIC_ROUTES.find((item) => item.name === routeName);

  if (!route) {
    console.warn(`[usePageMeta] Ruta pública desconocida: ${routeName}`);
    return;
  }

  const url = toCanonicalUrl(route.path);

  document.title = route.title;
  upsertMeta('name', 'description', route.description);
  upsertCanonical(url);

  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:site_name', ORGANIZATION.shortName);
  upsertMeta('property', 'og:locale', 'es_CL');
  upsertMeta('property', 'og:title', route.title);
  upsertMeta('property', 'og:description', route.description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE);

  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', route.title);
  upsertMeta('name', 'twitter:description', route.description);
  upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE);
}
