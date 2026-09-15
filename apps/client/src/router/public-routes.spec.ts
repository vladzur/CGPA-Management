import { describe, expect, it, vi } from 'vitest';
import {
  PUBLIC_ROUTES,
  publicRouteOutputFile,
} from '../content/public-routes';

const authStoreMock = {
  user: null as unknown,
  claims: {} as Record<string, unknown>,
  isInitialized: true,
  logout: vi.fn(),
  $subscribe: vi.fn(),
};

vi.mock('../stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

vi.mock('../layouts/PublicLayout.vue', () => ({
  default: { template: '<div class="public-layout" />' },
}));

vi.mock('../layouts/AdminLayout.vue', () => ({
  default: { template: '<div class="admin-layout" />' },
}));

vi.mock('../views/Home.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../views/About.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../views/PublicProjects.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../views/Transparency.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../views/ComunicadosPublic.vue', () => ({ default: { template: '<div />' } }));
vi.mock('../views/Contact.vue', () => ({ default: { template: '<div />' } }));

import router from './index';

/**
 * La lista canónica alimenta el menú, los metadatos, el prerender y el sitemap.
 * Si se desincroniza del router, alguna página dejaría de prerenderizarse o de
 * aparecer en la navegación, por lo que estas comprobaciones actúan como red de
 * seguridad ante cambios futuros.
 */
describe('public route catalogue', () => {
  it('should resolve every catalogued route in the router with the same name', () => {
    for (const route of PUBLIC_ROUTES) {
      const resolved = router.resolve(route.path);

      expect(resolved.name, `ruta ${route.path}`).toBe(route.name);
    }
  });

  it('should declare a unique path and a unique name per route', () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);
    const names = PUBLIC_ROUTES.map((route) => route.name);

    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should ship the metadata required by the prerender and the sitemap', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(route.navLabel.length).toBeGreaterThan(2);
      expect(route.title.length).toBeGreaterThan(10);
      expect(route.description.length).toBeGreaterThan(40);
      expect(Number(route.sitemapPriority)).toBeGreaterThan(0);
      expect(['weekly', 'monthly', 'yearly']).toContain(
        route.sitemapChangefreq,
      );
    }
  });

  it('should always declare the institutional home as the first route', () => {
    expect(PUBLIC_ROUTES[0].path).toBe('/');
    expect(PUBLIC_ROUTES[0].name).toBe('Home');
  });

  it('should exclude internal and verification routes from the catalogue', () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path);

    expect(paths).not.toContain('/admin');
    expect(paths).not.toContain('/login');
    expect(paths).not.toContain('/registro-interno-agb');
    expect(paths.some((path) => path.startsWith('/validar'))).toBe(false);
  });

  it('should map the home route to index.html', () => {
    expect(publicRouteOutputFile('/')).toBe('index.html');
  });

  it('should map every other route to its own html file', () => {
    expect(publicRouteOutputFile('/nosotros')).toBe('nosotros.html');
    expect(publicRouteOutputFile('/transparencia')).toBe('transparencia.html');
    expect(publicRouteOutputFile('/contacto/')).toBe('contacto.html');
  });

  it('should generate one output file per catalogued route', () => {
    const files = PUBLIC_ROUTES.map((route) =>
      publicRouteOutputFile(route.path),
    );

    expect(new Set(files).size).toBe(PUBLIC_ROUTES.length);
  });
});
