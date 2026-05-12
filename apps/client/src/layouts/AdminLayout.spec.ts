import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { RouterLink, RouterView } from 'vue-router';

// Estado del mock de auth
const authState = {
  claims: {} as Record<string, any>,
  user: null as any,
  token: null as string | null,
};

const mockLogout = vi.fn();
const mockPush = vi.fn();

// Mock de vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/admin',
    params: {},
    query: {},
    hash: '',
    fullPath: '/admin',
    name: 'Dashboard',
    matched: [],
    meta: {},
  }),
  useRouter: () => ({ push: mockPush }),
  RouterLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
  RouterView: {
    template: '<div class="router-view-mock"><slot /></div>',
  },
}));

// Mock del store de auth
vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    get claims() { return authState.claims; },
    get user() { return authState.user; },
    get token() { return authState.token; },
    logout: mockLogout,
    refreshToken: vi.fn(),
    isInitialized: true,
  }),
}));

import AdminLayout from './AdminLayout.vue';

describe('AdminLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.claims = { role: 'ADMIN', activo: true };
    authState.user = { uid: 'admin-uid', email: 'admin@cgpa.cl' };
    authState.token = 'token-123';
  });

  it('debe mostrar el título del panel de administración', () => {
    const wrapper = mount(AdminLayout);

    expect(wrapper.text()).toContain('CGPA Admin');
  });

  it('debe mostrar todos los enlaces de navegación para admin', () => {
    const wrapper = mount(AdminLayout);

    const text = wrapper.text();

    expect(text).toContain('Dashboard');
    expect(text).toContain('Proyectos');
    expect(text).toContain('Comunicados');
    expect(text).toContain('Usuarios');
  });

  it('debe ocultar enlaces de admin solo para usuarios no administradores', () => {
    authState.claims = { role: 'TESORERO', activo: true };

    const wrapper = mount(AdminLayout);

    const text = wrapper.text();

    expect(text).toContain('Dashboard');
    expect(text).toContain('Proyectos');
    expect(text).not.toContain('Comunicados');
    expect(text).not.toContain('Usuarios');
  });

  it('debe tener un botón de cerrar sesión', () => {
    const wrapper = mount(AdminLayout);

    const text = wrapper.text();
    // El botón de escritorio dice "Salir", el del menú mobile dice "Cerrar Sesión"
    expect(text).toMatch(/Salir|Cerrar Sesión/);
  });

  it('debe llamar a logout y redirigir al hacer clic en cerrar sesión', async () => {
    mockLogout.mockResolvedValue(undefined);

    const wrapper = mount(AdminLayout);
    // Buscar el botón de logout de escritorio
    const logoutBtn = wrapper.find('button.text-error');

    await logoutBtn.trigger('click');

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('debe renderizar RouterView para contenido anidado', () => {
    const wrapper = mount(AdminLayout);

    const routerView = wrapper.findComponent(RouterView);
    expect(routerView.exists()).toBe(true);
  });

  it('debe tener menú mobile con clase dropdown', () => {
    const wrapper = mount(AdminLayout);

    const dropdown = wrapper.find('.dropdown');
    expect(dropdown.exists()).toBe(true);
  });
});
