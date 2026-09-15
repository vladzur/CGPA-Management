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
 * Además graba el estado ya resuelto (saldo, proyectos y movimientos) dentro del
 * HTML, para que la aplicación lo use como estado inicial al montar. Sin eso, Vue
 * descartaría el contenido prerenderizado y volvería a mostrar un indicador de carga
 * hasta que Firestore responda.
 *
 * Uso:
 *   node scripts/prerender.mjs
 *
 * Variables de entorno:
 *   CHROME_PATH          Ruta al binario de Chrome si no se detecta automáticamente.
 *   PRERENDER_STRICT     Si vale `1`, la ausencia de Chrome hace fallar el build.
 *   PRERENDER_SETTLE_MS  Espera adicional tras la carga, antes de capturar el HTML.
 *   PRERENDER_DATA_TIMEOUT_MS  Espera máxima a que se resuelvan los datos dinámicos.
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

/** Espera máxima a que los bloques con datos dinámicos terminen de resolverse. */
const DATA_TIMEOUT_MS = Number(process.env.PRERENDER_DATA_TIMEOUT_MS ?? 8000);

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
 * Marca que el servidor inserta en el HTML que entrega durante el prerender.
 * La aplicación la detecta para publicar su estado ya resuelto.
 */
const PRERENDER_FLAG_SCRIPT = '<script>window.__PRERENDER__=true;</script>';

/** Prefijo del script con el estado que se incrusta en el HTML final. */
const INITIAL_STATE_OPEN = '<script>window.__INITIAL_STATE__=';
const SCRIPT_CLOSE = '</script>';

/** Inserta contenido al final del `<head>`, o al inicio si no lo encuentra. */
function injectIntoHead(html, content) {
  return html.includes('</head>')
    ? html.replace('</head>', `  ${content}\n  </head>`)
    : `${content}${html}`;
}

/**
 * Elimina el estado y la marca que haya inyectado una ejecución anterior.
 * Sin esto el script no sería idempotente: al ejecutarlo dos veces seguidas sobre
 * el mismo `dist/`, cada pasada acumularía una copia más del estado incrustado.
 */
/**
 * Quita los artefactos que inyecta el propio prerender: la marca de captura y el
 * estado incrustado. Se aplica tanto a la plantilla como al HTML capturado, de modo
 * que el resultado no dependa de lo que ya hubiera en `dist/` ni de una respuesta
 * servida por el service worker de una ejecución anterior.
 */
function stripInjectedArtifacts(html) {
  let result = html.split(PRERENDER_FLAG_SCRIPT).join('');

  let start = result.indexOf(INITIAL_STATE_OPEN);
  while (start !== -1) {
    const end = result.indexOf(SCRIPT_CLOSE, start);
    if (end === -1) break;

    result =
      result.slice(0, start) + result.slice(end + SCRIPT_CLOSE.length);
    start = result.indexOf(INITIAL_STATE_OPEN);
  }

  return result;
}

/**
 * Copia normalizada de la plantilla que Vite genera, guardada dentro de `dist/`.
 * El nombre empieza por punto, así que Firebase Hosting no la publica.
 */
const SHELL_FILE = '.prerender-shell.html';

/**
 * Devuelve la plantilla que se sirve durante la captura.
 * Se reutiliza entre ejecuciones y solo se regenera cuando `vite build` vacía el
 * directorio. Gracias a eso el prerender es determinista: ejecutarlo dos veces
 * seguidas sin recompilar produce exactamente los mismos archivos, en lugar de
 * acumular el estado y las precargas del resultado anterior.
 */
async function resolveShell() {
  const shellPath = path.join(distDir, SHELL_FILE);

  if (!existsSync(shellPath)) {
    const shell = stripInjectedArtifacts(
      await readFile(path.join(distDir, 'index.html'), 'utf8'),
    );

    await writeFile(shellPath, shell, 'utf8');
  }

  return shellPath;
}

/**
 * Graba el estado ya resuelto dentro del HTML para que la aplicación lo use como
 * estado inicial. Sin esto, Vue descartaría el contenido prerenderizado al montar
 * y volvería a pintar un indicador de carga hasta que Firestore responda.
 */
function withInitialState(html, state) {
  if (!state) return html;

  // Se escapa `<` para que el JSON no pueda cerrar la etiqueta script.
  const serialized = JSON.stringify(state).replaceAll(
    '<',
    String.raw`\u003c`,
  );

  return injectIntoHead(
    html,
    `<script>window.__INITIAL_STATE__=${serialized};</script>`,
  );
}

/**
 * Vite resuelve las URLs de los chunks que precarga en tiempo de ejecución, así que
 * al serializar el DOM quedan con el origen absoluto del servidor de prerender. Se
 * convierten en rutas relativas a la raíz para que apunten al dominio real y no al
 * puerto efímero de la máquina que generó el build.
 */
function normalizeLocalOrigin(html, port) {
  return html.split(`http://127.0.0.1:${port}`).join('');
}

/** Deja el HTML capturado listo para publicarse. */
function finalizeHtml(html, state, port) {
  return withInitialState(
    stripInjectedArtifacts(normalizeLocalOrigin(html, port)),
    state,
  );
}

/**
 * Servidor estático mínimo sobre `dist/`, con la misma caída a `index.html`
 * que usa Firebase Hosting para las rutas de la SPA.
 * Las páginas HTML se resuelven siempre desde `shellPath`, la plantilla original.
 */
function startStaticServer(shellPath) {
  const server = createServer(async (request, response) => {
    const requestedPath = decodeURIComponent(
      (request.url ?? '/').split('?')[0],
    );
    const resolved = path.resolve(distDir, `.${requestedPath}`);

    // Evita salir del directorio compilado mediante rutas como ../../etc
    const isInsideDist =
      resolved === distDir || resolved.startsWith(`${distDir}${path.sep}`);

    // Solo se sirven activos; las páginas HTML se resuelven desde la plantilla, incluido
    // `/index.html`, porque el service worker la solicita para su respaldo de navegación.
    const extension = path.extname(resolved);
    const isAssetRequest = Boolean(extension) && extension !== '.html';

    let filePath =
      isAssetRequest && isInsideDist && existsSync(resolved) ? resolved : null;

    if (filePath) {
      const exists = await readFile(filePath)
        .then(() => true)
        .catch(() => false);
      if (!exists) filePath = null;
    }

    if (!filePath) filePath = shellPath;

    try {
      const isHtml = path.extname(filePath) === '.html';
      const raw = await readFile(filePath);
      const body = isHtml
        ? Buffer.from(
            injectIntoHead(raw.toString('utf8'), PRERENDER_FLAG_SCRIPT),
            'utf8',
          )
        : raw;

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
  const shellPath = await resolveShell();

  try {
    ({ server, port } = await startStaticServer(shellPath));
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

        // Espera best-effort a que los bloques con datos (saldo, movimientos,
        // proyectos, comunicados) terminen de resolverse. Sin esta espera, un build
        // en el que Firestore responda lento grabaría un indicador de carga en el
        // HTML estático, y sin JavaScript quedaría visible de forma permanente.
        await page
          .waitForFunction(
            () =>
              document.querySelectorAll('.loading-spinner, .loading-bars')
                .length === 0,
            { timeout: DATA_TIMEOUT_MS },
          )
          .catch(() => {
            console.warn(
              `[prerender] ${route.path}: quedaron indicadores de carga visibles; se captura el estado actual.`,
            );
          });

        // Espera best-effort a que terminen las peticiones de datos (Firestore/API).
        await page
          .waitForNetworkIdle({ idleTime: 500, timeout: 5000 })
          .catch(() => undefined);

        await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

        const html = await page.content();

        // Estado ya resuelto por la aplicación, que se graba dentro del HTML.
        const resolvedState = await page
          .evaluate(() => window.__PRERENDER_STATE__ ?? null)
          .catch(() => null);

        rendered.set(
          publicRouteOutputFile(route.path),
          finalizeHtml(html, resolvedState, port),
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
