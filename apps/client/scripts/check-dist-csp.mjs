/**
 * Verifica que el HTML publicado no contenga scripts inline ejecutables.
 *
 * Los bloques `application/json` y `application/ld+json` son datos, no código.
 * El estado inicial del prerender debe viajar en un bloque JSON; este chequeo
 * falla si vuelve a convertirse en un script ejecutable.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(scriptDir, '..', 'dist');

const NON_EXECUTABLE_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/manifest+json',
]);

function isNonExecutable(attrs) {
  if (/\bsrc\s*=/i.test(attrs)) return true;

  const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  return type ? NON_EXECUTABLE_TYPES.has(type) : false;
}

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await htmlFiles(fullPath)));
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = await htmlFiles(distDir);
let failures = 0;

for (const file of files) {
  const html = await readFile(file, 'utf8');
  const scripts = html.match(/<script\b[^>]*>/gi) ?? [];

  for (const tag of scripts) {
    const attrs = tag.slice('<script'.length);

    if (!isNonExecutable(attrs)) {
      failures += 1;
      console.error(
        `[check-dist-csp] ${path.relative(distDir, file)} contiene un script inline ejecutable: ${tag}`,
      );
    }
  }

  if (html.includes('window.__INITIAL_STATE__=')) {
    failures += 1;
    console.error(
      `[check-dist-csp] ${path.relative(distDir, file)} todavía usa el estado inicial ejecutable.`,
    );
  }
}

if (failures > 0) {
  console.error(`[check-dist-csp] ${failures} problema(s) encontrados.`);
  process.exit(1);
}

console.log(
  `[check-dist-csp] ${files.length} archivo(s) HTML sin scripts inline ejecutables.`,
);
