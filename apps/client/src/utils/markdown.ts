import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

/**
 * Etiquetas permitidas en un comunicado. Se excluyen explícitamente las que
 * pueden ejecutar código o incrustar contenido activo (`script`, `iframe`,
 * `object`, `embed`, `form`, `svg`, `math`, etc.).
 */
const ALLOWED_TAGS = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

const ALLOWED_ATTR = ['alt', 'href', 'rel', 'src', 'target', 'title'];

/**
 * Solo se permiten enlaces http, https y mailto; rutas relativas y anclas.
 * `data:` y `javascript:` quedan fuera.
 */
const ALLOWED_URI_REGEXP =
  /^(?:(?:https?|mailto):|[#/]|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i;

let hooksInstalled = false;

/** Refuerza atributos de enlaces e imágenes después del saneamiento. */
function installHooks(): void {
  if (hooksInstalled) return;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    }

    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src') ?? '';

      // Las imágenes solo pueden venir por https o de una ruta del sitio.
      if (!/^https:\/\//i.test(src) && !src.startsWith('/')) {
        node.parentNode?.removeChild(node);
      }
    }
  });

  hooksInstalled = true;
}

/**
 * Renderiza Markdown y devuelve HTML saneado, apto para `v-html`.
 *
 * El saneamiento ocurre en el cliente incluso si la API ya rechazó el HTML
 * crudo: un comunicado antiguo o una respuesta manipulada no debe ejecutar
 * scripts en la vista pública ni en el panel de administración.
 */
export function renderMarkdown(contenido: string): string {
  installHooks();

  const unsafeHtml = marked.parse(contenido) as string;

  return DOMPurify.sanitize(unsafeHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: [
      'script',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'style',
      'svg',
      'math',
    ],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick', 'srcdoc'],
  }) as string;
}
