/**
 * Lista canónica de páginas públicas prerenderizables del sitio institucional.
 *
 * Es la única fuente de verdad para:
 *  - las etiquetas del menú de navegación principal,
 *  - los títulos y descripciones usados por `usePageMeta`,
 *  - las rutas que `scripts/prerender.mjs` convierte en HTML estático,
 *  - las entradas del `sitemap.xml` generado en el build.
 *
 * Las rutas de autenticación (`/login`, `/registro-interno-agb`) y de verificación
 * de documentos (`/validar/:uuid`) quedan fuera a propósito: no se indexan ni se
 * prerenderizan. Un test comprueba que esta lista siga coincidiendo con el router.
 */

export interface PublicRoute {
  path: string;
  /** Nombre de la ruta en vue-router. */
  name: string;
  /** Etiqueta mostrada en el menú principal. */
  navLabel: string;
  /** Título del documento. */
  title: string;
  /** Meta descripción de la página. */
  description: string;
  /** Prioridad declarada en el sitemap. */
  sitemapPriority: string;
  sitemapChangefreq: 'weekly' | 'monthly' | 'yearly';
}

export const PUBLIC_ROUTES = [
  {
    path: '/',
    name: 'Home',
    navLabel: 'Inicio',
    title:
      'CGPA Graham Bell — Centro General de Padres y Apoderados Liceo Alexander Graham Bell',
    description:
      'Sitio oficial del Centro General de Padres y Apoderados del Liceo Alexander Graham Bell de Villarrica: misión, proyectos, comunicados y rendición de cuentas.',
    sitemapPriority: '1.0',
    sitemapChangefreq: 'weekly',
  },
  {
    path: '/nosotros',
    name: 'About',
    navLabel: 'Nosotros',
    title: 'Nosotros — CGPA Graham Bell',
    description:
      'Misión, visión, objetivos, programas y directiva vigente del Centro General de Padres y Apoderados del Liceo Alexander Graham Bell.',
    sitemapPriority: '0.9',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/proyectos',
    name: 'PublicProjects',
    navLabel: 'Proyectos',
    title: 'Proyectos — CGPA Graham Bell',
    description:
      'Proyectos de infraestructura, equipamiento y material educativo financiados por el Centro General de Padres y Apoderados del Liceo Alexander Graham Bell.',
    sitemapPriority: '0.8',
    sitemapChangefreq: 'weekly',
  },
  {
    path: '/transparencia',
    name: 'Transparency',
    navLabel: 'Transparencia',
    title: 'Transparencia financiera — CGPA Graham Bell',
    description:
      'Fondo general disponible, ingresos, egresos y respaldos verificables del Centro General de Padres y Apoderados del Liceo Alexander Graham Bell.',
    sitemapPriority: '0.9',
    sitemapChangefreq: 'weekly',
  },
  {
    path: '/comunicados',
    name: 'PublicAnnouncements',
    navLabel: 'Comunicados',
    title: 'Comunicados — CGPA Graham Bell',
    description:
      'Comunicados oficiales de la directiva del Centro General de Padres y Apoderados del Liceo Alexander Graham Bell.',
    sitemapPriority: '0.8',
    sitemapChangefreq: 'weekly',
  },
  {
    path: '/contacto',
    name: 'Contact',
    navLabel: 'Contacto',
    title: 'Contacto — CGPA Graham Bell',
    description:
      'Dirección, canales de contacto y formulario para comunicarse con la directiva del Centro General de Padres y Apoderados del Liceo Alexander Graham Bell.',
    sitemapPriority: '0.7',
    sitemapChangefreq: 'yearly',
  },
] as const satisfies readonly PublicRoute[];

/** Unión de los nombres de ruta públicos válidos. */
export type PublicRouteName = (typeof PUBLIC_ROUTES)[number]['name'];

/**
 * Nombre del archivo HTML que genera el prerender para una ruta pública.
 * Con `cleanUrls` habilitado en Firebase Hosting, `/nosotros` se sirve desde
 * `dist/nosotros.html` y `/` desde `dist/index.html`.
 */
export function publicRouteOutputFile(routePath: string): string {
  if (routePath === '/') return 'index.html';

  const withoutLeadingSlash = routePath.startsWith('/')
    ? routePath.slice(1)
    : routePath;
  const withoutTrailingSlash = withoutLeadingSlash.endsWith('/')
    ? withoutLeadingSlash.slice(0, -1)
    : withoutLeadingSlash;

  return `${withoutTrailingSlash}.html`;
}
