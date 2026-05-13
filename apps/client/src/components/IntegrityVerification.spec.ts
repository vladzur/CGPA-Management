import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const { mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
}));

vi.mock('../plugins/axios', () => ({
  default: {
    get: mockAxiosGet,
  },
}));

import IntegrityVerification from './IntegrityVerification.vue';

describe('IntegrityVerification.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('debe renderizar el botón de verificación', () => {
    const wrapper = mount(IntegrityVerification);

    const btn = wrapper.find('button.btn');
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain('Verificar Integridad');
  });

  it('debe mostrar el spinner mientras verifica', async () => {
    mockAxiosGet.mockImplementation(() => new Promise(() => {}));

    const wrapper = mount(IntegrityVerification);

    const btn = wrapper.find('button.btn');
    await btn.trigger('click');

    expect(btn.attributes('disabled')).toBeDefined();
    expect(wrapper.find('.loading-spinner').exists()).toBe(true);
  });

  it('debe llamar a la API correcta al hacer clic', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        data: {
          valida: true,
          total_verificadas: 0,
          rupturas: [],
          mensaje: 'Cadena vacía.',
        },
      },
    });

    const wrapper = mount(IntegrityVerification);

    const btn = wrapper.find('button.btn');
    await btn.trigger('click');
    await flushPromises();

    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockAxiosGet).toHaveBeenCalledWith('/transactions/verify-integrity');
  });

  it('debe mostrar resultado válido cuando la cadena está íntegra', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        data: {
          valida: true,
          total_verificadas: 42,
          rupturas: [],
          mensaje: 'Cadena íntegra. Se verificaron 42 transacciones sin detectar alteraciones.',
        },
      },
    });

    const wrapper = mount(IntegrityVerification);

    const btn = wrapper.find('button.btn');
    await btn.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Cadena Íntegra');
    expect(wrapper.text()).toContain('42');
    expect(wrapper.find('.stat-value').text()).toBe('42');
  });

  it('debe mostrar rupturas cuando la cadena está comprometida', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        data: {
          valida: false,
          total_verificadas: 10,
          rupturas: [
            {
              documento_id: 'abc123def456',
              numero_secuencia: 5,
              razon: 'Hash de integridad no coincide.',
            },
          ],
          mensaje: 'Se detectó 1 alteración.',
        },
      },
    });

    const wrapper = mount(IntegrityVerification);

    const btn = wrapper.find('button.btn');
    await btn.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Cadena Comprometida');
    expect(wrapper.text()).toContain('5');
    expect(wrapper.text()).toContain('abc123def456');
    expect(wrapper.text()).toContain('Hash de integridad no coincide.');
  });

  it('debe mostrar mensaje de error cuando la API falla', async () => {
    mockAxiosGet.mockRejectedValue({
      response: { data: { message: 'Error interno del servidor' } },
    });

    const wrapper = mount(IntegrityVerification);

    const btn = wrapper.find('button.btn');
    await btn.trigger('click');
    await flushPromises();

    expect(wrapper.find('.alert-error').exists()).toBe(true);
    expect(wrapper.text()).toContain('Error interno del servidor');
  });

  it('debe cerrar el modal al hacer clic en Cerrar', async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        data: {
          valida: true,
          total_verificadas: 3,
          rupturas: [],
          mensaje: 'Cadena íntegra.',
        },
      },
    });

    const wrapper = mount(IntegrityVerification);

    const btn = wrapper.find('button.btn');
    await btn.trigger('click');
    await flushPromises();

    // El modal debe estar abierto
    expect(wrapper.find('.modal-open').exists()).toBe(true);

    // Clic en Cerrar
    const closeBtn = wrapper.find('.modal-action .btn');
    await closeBtn.trigger('click');

    // El modal debe cerrarse
    expect(wrapper.find('.modal-open').exists()).toBe(false);
  });
});
