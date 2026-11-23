import { marked, type Token } from 'marked';

/**
 * Resultado de validar un contenido Markdown.
 *
 * Las violaciones se describen sin devolver el contenido original, para no
 * repetir payloads maliciosos en respuestas ni en logs.
 */
export interface MarkdownPolicyViolation {
  message: string;
}

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const ALLOWED_IMAGE_PROTOCOLS = new Set(['https:']);

/** Recorre el árbol de tokens de `marked`, incluidos los anidados. */
function walkTokens(tokens: Token[], visit: (token: Token) => void): void {
  for (const token of tokens) {
    visit(token);

    const nested = (token as Token & { tokens?: Token[] }).tokens;
    if (Array.isArray(nested)) {
      walkTokens(nested, visit);
    }
  }
}

function isRelativeReference(value: string): boolean {
  return (
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('?') ||
    value.startsWith('./') ||
    value.startsWith('../')
  );
}

function protocolOf(value: string): string | null {
  const trimmed = value.trim();

  if (isRelativeReference(trimmed)) return null;

  try {
    return new URL(trimmed, 'https://cgpagrahambell.cl').protocol;
  } catch {
    return 'invalid:';
  }
}

/**
 * Valida que el contenido sea Markdown sin HTML crudo y con enlaces e imágenes
 * limitados a protocolos seguros.
 *
 * La política es la opción conservadora de RN-09: se rechaza todo HTML crudo
 * y se exige crear enlaces e imágenes con la sintaxis Markdown.
 */
export function findMarkdownPolicyViolations(
  contenido: string,
): MarkdownPolicyViolation[] {
  const violations = new Map<string, MarkdownPolicyViolation>();

  const add = (message: string) => {
    violations.set(message, { message });
  };

  const tokens = marked.lexer(contenido, { gfm: true });

  walkTokens(tokens, (token) => {
    if (token.type === 'html') {
      add(
        'El contenido no puede incluir HTML crudo; usa solo la sintaxis Markdown.',
      );
      return;
    }

    if (token.type === 'link') {
      const href = (token as Token & { href?: string }).href ?? '';
      const protocol = protocolOf(href);

      if (protocol !== null && !ALLOWED_LINK_PROTOCOLS.has(protocol)) {
        add(
          'Los enlaces solo pueden usar http, https o mailto. No se permiten javascript:, data: ni otros protocolos.',
        );
      }
      return;
    }

    if (token.type === 'image') {
      const href = (token as Token & { href?: string }).href ?? '';
      const protocol = protocolOf(href);

      if (protocol !== null && !ALLOWED_IMAGE_PROTOCOLS.has(protocol)) {
        add('Las imágenes solo pueden usar rutas relativas o https.');
      }
    }
  });

  return [...violations.values()];
}
