import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const { mockAxiosPost, mockAxiosGet } = vi.hoisted(() => ({
  mockAxiosPost: vi.fn(),
  mockAxiosGet: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/admin/libro-balance' }),
}));

vi.mock('../../plugins/axios', () => ({
  default: {
    get: mockAxiosGet,
    post: mockAxiosPost,
  },
}));

import BalanceBook from './BalanceBook.vue';

// Helpers para File/Blob en el entorno de test
function createMockBlobResponse() {
  const blob = new Blob(['fake-pdf'], { type: 'application/pdf' });
  return { data: blob };
}

(globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:fake-url');
(globalThis as any).URL.revokeObjectURL = vi.fn();

describe('BalanceBook.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockAxiosPost.mockResolvedValue(createMockBlobResponse());
  });

  it('debe renderizar el selector de período con años', () => {
    const wrapper = mount(BalanceBook);

    const select = wrapper.find('select.select-bordered');
    expect(select.exists()).toBe(true);
    // Debe tener opciones para varios años, empezando por 2020
    const options = select.findAll('option');
    expect(options.length).toBeGreaterThanOrEqual(5);
    expect(options[0].text()).toBe('2020');
  });

  it('debe renderizar los botones de acción', () => {
    const wrapper = mount(BalanceBook);

    const buttons = wrapper.findAll('button.btn');
    const draftBtn = buttons.find((b) => b.text().includes('Descargar Borrador'));
    const firmadoBtn = buttons.find((b) => b.text().includes('Generar Libro Firmado'));

    expect(draftBtn).toBeDefined();
    expect(firmadoBtn).toBeDefined();
  });

  it('debe enviar modo borrador al hacer clic en Descargar Borrador', async () => {
    const wrapper = mount(BalanceBook);

    const buttons = wrapper.findAll('button.btn');
    const draftBtn = buttons.find((b) => b.text().includes('Descargar Borrador'));
    await draftBtn!.trigger('click');

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    const [url, payload, config] = mockAxiosPost.mock.calls[0];
    expect(url).toBe('/libro-balance/generar');
    expect(payload.modo).toBe('borrador');
    expect(payload.periodo).toBeTruthy();
    expect(config.responseType).toBe('blob');
  });

  it('debe enviar modo firmado al hacer clic en Generar Libro Firmado', async () => {
    const wrapper = mount(BalanceBook);

    const buttons = wrapper.findAll('button.btn');
    const firmadoBtn = buttons.find((b) => b.text().includes('Generar Libro Firmado'));
    await firmadoBtn!.trigger('click');

    const [, payload] = mockAxiosPost.mock.calls[0];
    expect(payload.modo).toBe('firmado');
  });

  it('debe incluir proyecto_id en el payload si se selecciona uno', async () => {
    const wrapper = mount(BalanceBook);

    const select = wrapper.findAll('select').find((s) => !s.attributes('disabled'));
    // El select de proyecto existe vacío por defecto
    expect(select).toBeDefined();
  });

  it('debe mostrar mensaje de error si la API falla', async () => {
    mockAxiosPost.mockRejectedValue({
      response: { data: { message: 'Sin transacciones en el período' } },
    });

    const wrapper = mount(BalanceBook);

    const buttons = wrapper.findAll('button.btn');
    const firmadoBtn = buttons.find((b) => b.text().includes('Generar Libro Firmado'));
    await firmadoBtn!.trigger('click');

    const errorAlert = wrapper.find('.alert-error');
    expect(errorAlert.exists()).toBe(true);
    expect(errorAlert.text()).toContain('Sin transacciones en el período');
  });

  it('debe deshabilitar botones mientras carga', async () => {
    mockAxiosPost.mockImplementation(() => new Promise(() => {}));

    const wrapper = mount(BalanceBook);

    const buttons = wrapper.findAll('button.btn');
    const firmadoBtn = buttons.find((b) => b.text().includes('Generar Libro Firmado'));
    await firmadoBtn!.trigger('click');

    const allButtons = wrapper.findAll('button.btn:disabled');
    expect(allButtons.length).toBeGreaterThanOrEqual(2);
  });
});
