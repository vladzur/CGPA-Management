/**
 * Prerender estático del sitio institucional.
 *
 * Recorre las rutas públicas declaradas en `src/content/public-routes.ts`, renderiza
 * cada una en Chrome headless y guarda el HTML resultante en `dist/<ruta>.html`.
 * Con `cleanUrls` habilitado en `firebase.json`, `/nosotros` pasa a servirse desde
 * `nosotros.html`, de modo que el contenido institucional (nombre legal, misión,
 * personalidad jurídica y domicilio) esté presente en el HTML sin depender de
 * JavaScript. Ese es uno de los requisitos que evalúa Google for Nonprofits.
 *
 * Uso:
 *   node scripts/prerender.mjs
 *
 * Variables de entorno:
 *   CHROME_PATH        Ruta al binario de Chrome (si no se detecta automáticamente).
 *   PRERENDER_STRICT   Si vale `1`, la ausencia de Chrome hace fallar el build.
 *   PRERENDER_SETTLE_MS  Espera adicional tras la carga, antes de capturar el HTML.
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const distDir = path.join(clientRoot, 'dist');

const { PUBLIC_ROUTES, publicRouteOutputFile } = await import(
  '../src/content/public-routes.ts'
);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const SETTLE_MS = Number(process.env.PRERENDER_SETTLE_MS ?? 400);

/** Ubicaciones habituales del binario de Chrome según plataforma. */
function chromeCandidates() {
  const fromEnv = [
    process.env.CHROME_PATH,
    process.env.CHROMEWEBDRIVER &&
      path.join(process.env.CHROMEWEBDRIVER, 'chrome-linux64', 'chrome'),
  ].filter(Boolean);

  return [
    ...fromEnv,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
    String.raw`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
  ];
}

function findChrome() {
  return chromeCandidates().find((candidate) => existsSync(candidate));
}

/**
 * Servidor estático mínimo sobre `dist/`, con la misma caída a `index.html`
 * que usa Firebase Hosting para las rutas de la SPA.
 */
function startStaticServer() {
  const server = createServer(async (request, response) => {
    const requestedPath = decodeURIComponent(
      (request.url ?? '/').split('?')[0],
    );
    const resolved = path.resolve(distDir, `.${requestedPath}`);

    // Evita salir del directorio compilado mediante rutas como ../../etc
    const isInsideDist =
      resolved === distDir || resolved.startsWith(`${distDir}${path.sep}`);

    let filePath = isInsideDist && existsSync(resolved) ? resolved : null;

    if (filePath) {
      const stats = await readFile(filePath)
        .then(() => true)
        .catch(() => false);
      if (!stats) filePath = null;
    }

    if (!filePath) filePath = path.join(distDir, 'index.html');

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type':
          MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('No encontrado');
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);

  const urls = PUBLIC_ROUTES.map((route) => {
    const loc = route.path === '/' ? '/' : route.path;
    return [
      '  <url>',
      `    <loc>https://cgpagrahambell.cl${loc}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${route.sitemapChangefreq}</changefreq>`,
      `    <priority>${route.sitemapPriority}</priority>`,
      '  </url>',
    ].join('\n');
  }).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Omite el prerender sin bloquear el despliegue.
 * Solo se considera un error fatal cuando `PRERENDER_STRICT=1`, porque el sitio
 * sigue siendo funcional sin HTML estático: Firebase Hosting sirve la SPA igual.
 */
async function abortPrerender(message) {
  if (process.env.PRERENDER_STRICT === '1') {
    console.error(message);
    process.exit(1);
  }

  console.warn(`${message} Se publica la SPA sin HTML estático.`);
  await writeFile(path.join(distDir, 'sitemap.xml'), buildSitemap(), 'utf8');
}

async function main() {
  if (!existsSync(path.join(distDir, 'index.html'))) {
    console.error(
      '[prerender] No se encontró dist/index.html. Ejecuta `vite build` antes de este script.',
    );
    process.exit(1);
  }

  const chromePath = findChrome();

  if (!chromePath) {
    await abortPrerender(
      '[prerender] No se encontró Chrome. Define CHROME_PATH para habilitarlo.',
    );
    return;
  }

  let browser;
  let server;
  let port;

  try {
    ({ server, port } = await startStaticServer());
    const { default: puppeteer } = await import('puppeteer-core');

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  } catch (error) {
    server?.close();
    await abortPrerender(
      `[prerender] No se pudo iniciar el prerender (${error.message}).`,
    );
    return;
  }

  const rendered = new Map();

  try {
    for (const route of PUBLIC_ROUTES) {
      let page;

      try {
        page = await browser.newPage();
        const url = `http://127.0.0.1:${port}${route.path === '/' ? '/' : route.path}`;

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        await page
          .waitForFunction('window.__PRERENDER_READY__ === true', {
            timeout: 15000,
          })
          .catch(() => {
            console.warn(
              `[prerender] ${route.path}: la aplicación no emitió la señal de listo; se captura el estado actual.`,
            );
          });

        // Espera best-effort a que terminen las peticiones de datos (Firestore/API).
        await page
          .waitForNetworkIdle({ idleTime: 500, timeout: 5000 })
          .catch(() => undefined);

        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

        rendered.set(
          publicRouteOutputFile(route.path),
          await page.content(),
        );

        console.log(
          `[prerender] ${route.path} → ${publicRouteOutputFile(route.path)}`,
        );
      } catch (error) {
        // Una ruta que falla no debe impedir que se publiquen las demás.
        console.warn(
          `[prerender] ${route.path}: no se pudo capturar el HTML (${error.message}).`,
        );
      } finally {
        await page?.close().catch(() => undefined);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  // Se escriben todos los archivos al final para no alterar el HTML que el
  // servidor está entregando durante el recorrido de rutas.
  for (const [fileName, html] of rendered) {
    await writeFile(path.join(distDir, fileName), html, 'utf8');
  }

  await writeFile(path.join(distDir, 'sitemap.xml'), buildSitemap(), 'utf8');
  console.log(
    `[prerender] Listo: ${rendered.size} páginas prerenderizadas y sitemap.xml actualizado.`,
  );
}

await main();
