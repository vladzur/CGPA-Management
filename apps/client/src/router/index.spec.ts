import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock del store de auth usado por el router
const authStoreMock = {
  user: null as any,
  claims: {} as Record<string, any>,
  isInitialized: true,
  logout: vi.fn(),
  $subscribe: vi.fn(),
};

vi.mock('../stores/auth', () => ({
  useAuthStore: () => authStoreMock,
}));

// Mock de los layouts y vistas para evitar imports de componentes
vi.mock('../layouts/AdminLayout.vue', () => ({
  default: { template: '<div class="admin-layout"><slot /><router-view /></div>' },
}));

vi.mock('../layouts/PublicLayout.vue', () => ({
  default: { template: '<div class="public-layout"><slot /><router-view /></div>' },
}));

vi.mock('../views/Login.vue', () => ({
  default: { template: '<div class="login-page" />' },
}));

vi.mock('../views/Register.vue', () => ({
  default: { template: '<div class="register-page" />' },
}));

vi.mock('../views/Dashboard.vue', () => ({
  default: { template: '<div class="dashboard" />' },
}));

vi.mock('../views/ProjectList.vue', () => ({
  default: { template: '<div class="project-list" />' },
}));

vi.mock('../views/ProjectDetail.vue', () => ({
  default: { template: '<div class="project-detail" />' },
}));

vi.mock('../views/ComunicadosPublic.vue', () => ({
  default: { template: '<div class="comunicados-public" />' },
}));

vi.mock('../views/admin/AdminUsers.vue', () => ({
  default: { template: '<div class="admin-users" />' },
}));

vi.mock('../views/Home.vue', () => ({
  default: { template: '<div class="home-view" />' },
}));

vi.mock('../views/About.vue', () => ({
  default: { template: '<div class="about-view" />' },
}));

vi.mock('../views/PublicProjects.vue', () => ({
  default: { template: '<div class="public-projects-view" />' },
}));

vi.mock('../views/Transparency.vue', () => ({
  default: { template: '<div class="transparency-view" />' },
}));

vi.mock('../views/Contact.vue', () => ({
  default: { template: '<div class="contact-view" />' },
}));

vi.mock('../views/admin/AdminMessages.vue', () => ({
  default: { template: '<div class="admin-messages" />' },
}));

vi.mock('../views/admin/ComunicadosAdmin.vue', () => ({
  default: { template: '<div class="comunicados-admin" />' },
}));

// Importamos las rutas directamente del módulo
// Reconstruimos el router para testing
describe('Router', () => {
  let router: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    authStoreMock.user = null;
    authStoreMock.claims = {};
    authStoreMock.isInitialized = true;

    // Construir router fresco para cada test
    const routerModule = await import('./index');
    router = routerModule.default;
    await router.push('/'); // Reset a ruta inicial
  });

  describe('rutas públicas', () => {
    it('debe resolver la portada institucional', () => {
      expect(router.resolve('/').name).toBe('Home');
    });

    it('debe resolver la página de la organización', () => {
      expect(router.resolve('/nosotros').name).toBe('About');
    });

    it('debe resolver el listado público de proyectos', () => {
      expect(router.resolve('/proyectos').name).toBe('PublicProjects');
    });

    it('debe resolver la página de transparencia', () => {
      expect(router.resolve('/transparencia').name).toBe('Transparency');
    });

    it('debe resolver la ruta de comunicados públicos', () => {
      expect(router.resolve('/comunicados').name).toBe('PublicAnnouncements');
    });

    it('debe resolver la ruta de contacto', () => {
      expect(router.resolve('/contacto').name).toBe('Contact');
    });

    it('debe resolver la ruta de login', () => {
      expect(router.resolve('/login').name).toBe('Login');
    });

    it('debe resolver la ruta de registro', () => {
      expect(router.resolve('/registro-interno-agb').name).toBe('Register');
    });

    it('debe resolver la verificación de documentos con su uuid', () => {
      const resolved = router.resolve('/validar/uuid-123');
      expect(resolved.name).toBe('ValidarDocumento');
      expect(resolved.params.uuid).toBe('uuid-123');
    });

    it('debe anidar las páginas institucionales bajo el layout público', () => {
      const resolved = router.resolve('/nosotros');

      expect(resolved.matched).toHaveLength(2);
      expect(resolved.matched[0].path).toBe('/');
    });
  });

  describe('rutas de administración', () => {
    it('debe resolver el dashboard como ruta anidada', () => {
      const resolved = router.resolve('/admin');
      expect(resolved.name).toBe('Dashboard');
    });

    it('debe resolver proyectos como ruta anidada bajo /admin', () => {
      const resolved = router.resolve('/admin/proyectos');
      expect(resolved.name).toBe('ProjectList');
    });

    it('debe resolver detalle de proyecto como ruta anidada', () => {
      const resolved = router.resolve('/admin/proyectos/123');
      expect(resolved.name).toBe('ProjectDetail');
      expect(resolved.params.id).toBe('123');
    });

    it('debe resolver usuarios como ruta anidada bajo /admin', () => {
      const resolved = router.resolve('/admin/usuarios');
      expect(resolved.name).toBe('AdminUsers');
    });

    it('debe resolver comunicados admin como ruta anidada', () => {
      const resolved = router.resolve('/admin/comunicados');
      expect(resolved.name).toBe('ComunicadosAdmin');
    });

    it('debe resolver la bandeja de mensajes como ruta anidada', () => {
      const resolved = router.resolve('/admin/mensajes');
      expect(resolved.name).toBe('AdminMessages');
    });
  });

  describe('redirects de compatibilidad', () => {
    it('no debe redirigir el listado público de proyectos al panel', () => {
      const route = router
        .getRoutes()
        .find((r: { path: string }) => r.path === '/proyectos');

      expect(route).toBeDefined();
      expect(route!.redirect).toBeUndefined();
    });

    it('debe tener configurado el redirect de /proyectos/:id a /admin/proyectos/:id', () => {
      const route = router.getRoutes().find((r: { path: string; redirect?: unknown }) => r.path === '/proyectos/:id');
      expect(route).toBeDefined();
      expect(route!.redirect).toBeDefined();
    });

    it('debe tener configurado el redirect de /admin/pendientes a /admin/usuarios', () => {
      const route = router.getRoutes().find((r: { path: string; redirect?: unknown }) => r.path === '/admin/pendientes');
      expect(route).toBeDefined();
      expect(route!.redirect).toBe('/admin/usuarios');
    });
  });
});
