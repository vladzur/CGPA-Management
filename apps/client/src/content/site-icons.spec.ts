/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Raíz del paquete cliente. Bajo happy-dom `import.meta.url` no es una URL de
 * archivo, así que se sube desde el directorio de trabajo hasta encontrar la
 * carpeta que contiene `index.html` y el logo público.
 */
function findClientRoot(start: string): string {
  let current = path.resolve(start);

  for (let depth = 0; depth < 5; depth += 1) {
    const hasTemplate = existsSync(path.join(current, 'index.html'));
    const hasLogo = existsSync(path.join(current, 'public', 'logo-cgpa.png'));

    if (hasTemplate && hasLogo) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  throw new Error(`No se encontró la raíz del cliente desde ${start}`);
}

const clientRoot = findClientRoot(process.cwd());
const publicDir = path.join(clientRoot, 'public');

const indexHtml = readFileSync(path.join(clientRoot, 'index.html'), 'utf-8');
const viteConfigSource = readFileSync(
  path.join(clientRoot, 'vite.config.ts'),
  'utf-8',
);

interface IconLink {
  rel: string;
  href: string;
  sizes: string | null;
  type: string | null;
}

/**
 * Extrae del `index.html` las etiquetas que declaran los iconos del sitio.
 * La plantilla es estática y no se puede importar, así que se lee como texto.
 */
function parseIconLinks(): IconLink[] {
  const tags = indexHtml.match(/<link\b[^>]*>/gi) ?? [];

  return tags
    .map((tag) => ({
      rel: tag.match(/rel="([^"]+)"/i)?.[1] ?? '',
      href: tag.match(/href="([^"]+)"/i)?.[1] ?? '',
      sizes: tag.match(/sizes="([^"]+)"/i)?.[1] ?? null,
      type: tag.match(/type="([^"]+)"/i)?.[1] ?? null,
    }))
    .filter((link) => link.rel === 'icon' || link.rel === 'apple-touch-icon');
}

/** Nombre del archivo servido, sin la barra inicial de la ruta pública. */
function assetName(href: string): string {
  return href.startsWith('/') ? href.slice(1) : href;
}

interface PngInfo {
  width: number;
  height: number;
  colorType: number;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Lee dimensiones y tipo de color directamente de la cabecera IHDR. */
function readPngInfo(fileName: string): PngInfo {
  const buffer = readFileSync(path.join(publicDir, fileName));

  expect(
    buffer.subarray(0, 8).equals(PNG_SIGNATURE),
    `${fileName} no tiene firma PNG`,
  ).toBe(true);

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    // 6 = RGBA: los iconos deben conservar la transparencia del escudo.
    colorType: buffer[25],
  };
}

/** Devuelve los tamaños declarados en el contenedor .ico (0 equivale a 256). */
function readIcoSizes(fileName: string): number[] {
  const buffer = readFileSync(path.join(publicDir, fileName));
  const frameCount = buffer.readUInt16LE(4);
  const sizes: number[] = [];

  for (let index = 0; index < frameCount; index += 1) {
    const width = buffer[6 + index * 16] || 256;
    const height = buffer[7 + index * 16] || 256;

    expect(width, `${fileName} con marco no cuadrado`).toBe(height);
    sizes.push(width);
  }

  return sizes.sort((a, b) => a - b);
}

const iconLinks = parseIconLinks();

/**
 * La pestaña del navegador mostraba el logo por defecto de Vite porque
 * `index.html` declaraba un `favicon.svg` ajeno al escudo oficial y los
 * navegadores prefieren el SVG sobre el ICO. Estas comprobaciones fijan el
 * juego de iconos al logo del CGPA y avisan si se vuelve a colar otro archivo.
 */
describe('site icon catalogue', () => {
  it('should declare a favicon and a touch icon', () => {
    const rels = iconLinks.map((link) => link.rel);

    expect(rels).toContain('icon');
    expect(rels).toContain('apple-touch-icon');
  });

  it('should resolve every declared icon to an existing file in public', () => {
    expect(iconLinks.length).toBeGreaterThan(0);

    for (const link of iconLinks) {
      const fileName = assetName(link.href);

      expect(fileName, `ruta absoluta no soportada: ${link.href}`).not.toContain(
        ':',
      );
      expect(
        existsSync(path.join(publicDir, fileName)),
        `falta public/${fileName}`,
      ).toBe(true);
    }
  });

  it('should not declare a foreign svg favicon', () => {
    const svgLinks = iconLinks.filter(
      (link) => link.type === 'image/svg+xml' || link.href.endsWith('.svg'),
    );

    expect(svgLinks).toEqual([]);
    // El escudo no tiene versión vectorial: si reaparece el SVG, es el de Vite.
    expect(existsSync(path.join(publicDir, 'favicon.svg'))).toBe(false);
  });

  it('should declare png icons with alpha at the announced sizes', () => {
    const pngLinks = iconLinks.filter((link) => link.href.endsWith('.png'));

    expect(pngLinks.length).toBeGreaterThan(0);

    for (const link of pngLinks) {
      const fileName = assetName(link.href);
      const info = readPngInfo(fileName);

      // El icono de iOS se compone sobre un fondo propio: se mantiene opaco.
      if (link.rel === 'icon') {
        expect(info.colorType, `public/${fileName} sin canal alfa`).toBe(6);
      }

      expect(`${info.width}x${info.height}`).toBe(link.sizes);
    }
  });

  it('should keep the ico container with the 16, 32 and 48 frames', () => {
    expect(readIcoSizes('favicon.ico')).toEqual([16, 32, 48]);
  });

  it('should serve the official logo for the apple touch icon', () => {
    const info = readPngInfo('apple-touch-icon.png');

    expect(info.width).toBe(180);
    expect(info.height).toBe(180);
  });

  it('should list every declared icon in the service worker precache assets', () => {
    for (const link of iconLinks) {
      const fileName = assetName(link.href);

      expect(
        viteConfigSource.includes(`'${fileName}'`),
        `includeAssets no incluye ${fileName}`,
      ).toBe(true);
    }
  });
});
