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

vi.mock('../views/PublicView.vue', () => ({
  default: { template: '<div class="public-view" />' },
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
    it('debe resolver la ruta raíz', () => {
      const resolved = router.resolve('/');
      expect(resolved.name).toBe('PublicView');
    });

    it('debe resolver la ruta de login', () => {
      const resolved = router.resolve('/login');
      expect(resolved.name).toBe('Login');
    });

    it('debe resolver la ruta de registro', () => {
      const resolved = router.resolve('/registro-interno-agb');
      expect(resolved.name).toBe('Register');
    });

    it('debe resolver la ruta de comunicados públicos', () => {
      const resolved = router.resolve('/comunicados');
      expect(resolved.name).toBe('ComunicadosPublic');
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
  });

  describe('redirects de compatibilidad', () => {
    it('debe tener configurado el redirect de /proyectos a /admin/proyectos', () => {
      const route = router.getRoutes().find((r) => r.path === '/proyectos');
      expect(route).toBeDefined();
      expect(route!.redirect).toBe('/admin/proyectos');
    });

    it('debe tener configurado el redirect de /proyectos/:id a /admin/proyectos/:id', () => {
      const route = router.getRoutes().find((r) => r.path === '/proyectos/:id');
      expect(route).toBeDefined();
      expect(route!.redirect).toBeDefined();
    });

    it('debe tener configurado el redirect de /admin/pendientes a /admin/usuarios', () => {
      const route = router.getRoutes().find((r) => r.path === '/admin/pendientes');
      expect(route).toBeDefined();
      expect(route!.redirect).toBe('/admin/usuarios');
    });
  });
});
