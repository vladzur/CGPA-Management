/**
 * Auditoría de solo lectura del Markdown de los comunicados.
 *
 * Lista los comunicados que contienen HTML crudo o enlaces con protocolos no
 * permitidos. No modifica ningún documento: es un dry-run para que la directiva
 * decida qué contenido debe corregirse antes de aplicar la política de RN-09.
 *
 * Uso:
 *   node scripts/audit-markdown-content.mjs
 *   node scripts/audit-markdown-content.mjs --json
 *
 * Requiere credenciales de Firebase Admin en el entorno (o un emulador).
 */
import 'dotenv/config';
import * as admin from 'firebase-admin';
import { marked } from 'marked';

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const ALLOWED_IMAGE_PROTOCOLS = new Set(['https:']);

function walkTokens(tokens, visit) {
  for (const token of tokens) {
    visit(token);
    if (Array.isArray(token.tokens)) {
      walkTokens(token.tokens, visit);
    }
  }
}

function isRelativeReference(value) {
  return (
    value.startsWith('/') ||
    value.startsWith('#') ||
    value.startsWith('?') ||
    value.startsWith('./') ||
    value.startsWith('../')
  );
}

function protocolOf(value) {
  const trimmed = value.trim();
  if (isRelativeReference(trimmed)) return null;

  try {
    return new URL(trimmed, 'https://cgpagrahambell.cl').protocol;
  } catch {
    return 'invalid:';
  }
}

function findViolations(contenido) {
  const violations = new Set();

  walkTokens(marked.lexer(contenido ?? '', { gfm: true }), (token) => {
    if (token.type === 'html') {
      violations.add('HTML crudo');
      return;
    }

    if (token.type === 'link') {
      const protocol = protocolOf(token.href ?? '');
      if (protocol !== null && !ALLOWED_LINK_PROTOCOLS.has(protocol)) {
        violations.add('Enlace con protocolo no permitido');
      }
      return;
    }

    if (token.type === 'image') {
      const protocol = protocolOf(token.href ?? '');
      if (protocol !== null && !ALLOWED_IMAGE_PROTOCOLS.has(protocol)) {
        violations.add('Imagen con protocolo no permitido');
      }
    }
  });

  return [...violations];
}

async function main() {
  if (!admin.apps.length) {
    admin.initializeApp(
      process.env.FIREBASE_PROJECT_ID
        ? { projectId: process.env.FIREBASE_PROJECT_ID }
        : undefined,
    );
  }

  const snapshot = await admin.firestore().collection('comunicados').get();
  const findings = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const violations = findViolations(data.contenido);

    if (violations.length > 0) {
      findings.push({
        id: doc.id,
        titulo: data.titulo ?? '(sin título)',
        estado: data.estado ?? '(sin estado)',
        violations,
      });
    }
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ revisados: snapshot.size, hallazgos: findings }, null, 2));
  } else {
    console.log(
      `[audit-markdown] Revisados ${snapshot.size} comunicados (dry-run, sin cambios).`,
    );

    if (findings.length === 0) {
      console.log('[audit-markdown] No se encontraron comunicados fuera de la política.');
    } else {
      for (const finding of findings) {
        console.log(
          `- ${finding.id} [${finding.estado}] "${finding.titulo}": ${finding.violations.join(', ')}`,
        );
      }
      console.log(
        `[audit-markdown] ${findings.length} comunicados requieren revisión manual.`,
      );
    }
  }

  process.exitCode = 0;
}

main().catch((error) => {
  console.error(`[audit-markdown] Error: ${error.message}`);
  process.exitCode = 1;
});
