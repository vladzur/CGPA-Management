import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const authState = {
  claims: {} as Record<string, any>,
  token: null as string | null,
};

const mockPush = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockRegister = vi.fn();
const mockLoginWithGoogle = vi.fn();
const mockLogout = vi.fn();
const mockRefreshToken = vi.fn();

vi.mock('../stores/auth', () => ({
  useAuthStore: () => ({
    register: mockRegister,
    loginWithGoogle: mockLoginWithGoogle,
    logout: mockLogout,
    refreshToken: mockRefreshToken,
    get claims() { return authState.claims; },
    get token() { return authState.token; },
    user: null,
    isInitialized: true,
  }),
}));

import Register from './Register.vue';

describe('Register.vue - Google Sign-Up', () => {
  beforeAll(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Usuario registrado correctamente' }), { status: 201 })
    ));
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    authState.claims = {};
    authState.token = null;
  });

  it('debe mostrar el botón de registro con Google', () => {
    const wrapper = mount(Register);

    const googleButton = wrapper.find('button.btn-outline');
    expect(googleButton.exists()).toBe(true);
    expect(googleButton.text()).toContain('Registrarse con Google');
  });

  it('debe mostrar el icono SVG de Google en el botón de registro', () => {
    const wrapper = mount(Register);

    const svg = wrapper.find('button.btn-outline svg');
    expect(svg.exists()).toBe(true);
  });

  it('debe mantener el formulario de registro manual funcionando', () => {
    const wrapper = mount(Register);

    const nameInput = wrapper.find('input[type="text"]');
    const emailInput = wrapper.find('input[type="email"]');
    const passwordInput = wrapper.find('input[type="password"]');
    const submitButton = wrapper.find('button[type="submit"]');

    expect(nameInput.exists()).toBe(true);
    expect(emailInput.exists()).toBe(true);
    expect(passwordInput.exists()).toBe(true);
    expect(submitButton.text()).toContain('Registrarse');
  });

  it('debe registrar al usuario con Google y mostrar éxito', async () => {
    mockLoginWithGoogle.mockResolvedValue({ uid: 'google-uid', email: 'new@gmail.com' });
    authState.token = 'valid-token';

    const wrapper = mount(Register);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(mockLoginWithGoogle).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Registro completado');
  });

  it('debe mostrar error si el usuario de Google ya existe', async () => {
    mockLoginWithGoogle.mockResolvedValue({ uid: 'existing-uid' });
    authState.token = 'valid-token';

    // Mockear fetch para devolver 400 (usuario ya registrado)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'El usuario ya está registrado' }), { status: 400 })
    ));

    const wrapper = mount(Register);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(mockLogout).toHaveBeenCalled();
    expect(wrapper.text()).toContain('Ya existe una cuenta con este correo');
  });

  it('debe mostrar error cuando el usuario cierra el popup de Google', async () => {
    mockLoginWithGoogle.mockRejectedValue({
      code: 'auth/popup-closed-by-user',
      message: 'Pop-up closed',
    });

    const wrapper = mount(Register);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Registro con Google cancelado');
  });

  it('debe mostrar error cuando la cuenta ya existe con otra credencial', async () => {
    mockLoginWithGoogle.mockRejectedValue({
      code: 'auth/account-exists-with-different-credential',
      message: 'Account exists',
    });

    const wrapper = mount(Register);
    const googleButton = wrapper.find('button.btn-outline');

    await googleButton.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Ya existe una cuenta con este correo usando otro método de acceso');
  });

  it('debe deshabilitar los botones mientras carga', async () => {
    mockLoginWithGoogle.mockImplementation(() => new Promise(() => {}));

    const wrapper = mount(Register);
    const googleButton = wrapper.find('button.btn-outline');
    const submitButton = wrapper.find('button[type="submit"]');

    await googleButton.trigger('click');
    await flushPromises();

    expect(googleButton.attributes('disabled')).toBeDefined();
    expect(submitButton.attributes('disabled')).toBeDefined();
  });
});
