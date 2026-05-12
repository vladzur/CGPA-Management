import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

// Estado compartido para el mock del store de auth
const authState = {
  claims: {} as Record<string, any>,
  token: null as string | null,
};

// Mock del router
const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock del store de auth con getters para acceder a authState
const mockLogin = vi.fn();
const mockLoginWithGoogle = vi.fn();
const mockLogout = vi.fn();
const mockRefreshToken = vi.fn();

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    login: mockLogin,
    loginWithGoogle: mockLoginWithGoogle,
    logout: mockLogout,
    refreshToken: mockRefreshToken,
    get claims() { return authState.claims; },
    get token() { return authState.token; },
    user: null,
    isInitialized: true,
  }),
}));

import Login from './Login.vue';

describe('Login.vue - Google Sign-In', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok' }), { status: 200 })
    ));
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.claims = {};
    authState.token = null;
  });

  it('debe mostrar el botón de ingreso con Google', () => {
    const wrapper = mount(Login);

    const googleButton = wrapper.find('button.btn-outline');
    expect(googleButton.exists()).toBe(true);
    expect(googleButton.text()).toContain('Ingresar con Google');
  });

  it('debe mostrar el icono SVG de Google en el botón', () => {
    const wrapper = mount(Login);

    const svg = wrapper.find('button.btn-outline svg');
    expect(svg.exists()).toBe(true);
  });

  it('debe mantener el formulario de email/password funcionando', () => {
    const wrapper = mount(Login);

    const emailInput = wrapper.find('input[type="email"]');
    const passwordInput = wrapper.find('input[type="password"]');
    const submitButton = wrapper.find('button[type="submit"]');

    expect(emailInput.exists()).toBe(true);
    expect(passwordInput.exists()).toBe(true);
    expect(submitButton.exists()).toBe(true);
  });

  it('debe llamar a loginWithGoogle al hacer clic en el botón de Google', async () => {
    mockLoginWithGoogle.mockResolvedValue({ uid: 'google-uid' });

    const wrapper = mount(Login);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(mockLoginWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('debe redirigir a /admin si el usuario de Google está activo', async () => {
    mockLoginWithGoogle.mockResolvedValue({ uid: 'google-uid' });
    authState.claims = { role: 'ADMIN', activo: true };
    authState.token = 'valid-token';

    const wrapper = mount(Login);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(mockPush).toHaveBeenCalledWith('/admin');
  });

  it('debe mostrar error de cuenta pendiente si el usuario de Google no está activo', async () => {
    mockLoginWithGoogle.mockResolvedValue({ uid: 'google-uid' });
    authState.claims = { role: 'PENDIENTE', activo: false };
    authState.token = 'valid-token';

    const wrapper = mount(Login);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(mockLogout).toHaveBeenCalled();
    expect(wrapper.text()).toContain('pendiente de aprobación');
  });

  it('debe mostrar error cuando el usuario cierra el popup de Google', async () => {
    const popupError = {
      code: 'auth/popup-closed-by-user',
      message: 'Pop-up closed',
    };
    mockLoginWithGoogle.mockRejectedValue(popupError);

    const wrapper = mount(Login);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Inicio de sesión con Google cancelado');
  });

  it('debe mostrar error cuando la cuenta ya existe con otra credencial', async () => {
    const credentialError = {
      code: 'auth/account-exists-with-different-credential',
      message: 'Account exists',
    };
    mockLoginWithGoogle.mockRejectedValue(credentialError);

    const wrapper = mount(Login);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Ya existe una cuenta con este correo usando otro método de acceso');
  });

  it('debe deshabilitar los botones mientras carga', async () => {
    mockLoginWithGoogle.mockImplementation(() => new Promise(() => {}));

    const wrapper = mount(Login);
    const googleButton = wrapper.find('button.btn-outline');
    const submitButton = wrapper.find('button[type="submit"]');

    await googleButton.trigger('click');
    await flushPromises();

    expect(googleButton.attributes('disabled')).toBeDefined();
    expect(submitButton.attributes('disabled')).toBeDefined();
  });
});
