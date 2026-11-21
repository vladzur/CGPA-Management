import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mockPost = vi.fn();
const mockRedirect = vi.fn();

vi.mock('../plugins/axios', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));

vi.mock('../utils/pago-form', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/pago-form')>();

  return {
    ...actual,
    redirectToPaymentPortal: (url: string) => mockRedirect(url),
  };
});

import Pagar from './Pagar.vue';

async function fillValidForm(
  wrapper: ReturnType<typeof mount>,
  options: { monto?: string; estudiante?: string } = {},
) {
  await wrapper.find('#pago-nombre').setValue('Juan Pérez');
  await wrapper.find('#pago-email').setValue('apoderado@ejemplo.cl');
  await wrapper.find('#pago-monto').setValue(options.monto ?? '25000');

  if (options.estudiante !== undefined) {
    await wrapper.find('#pago-estudiante').setValue(options.estudiante);
  }
}

describe('Pagar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({
      data: { payment_url: 'https://khipu.com/payment/info/abc123' },
    });
  });

  it('should render the Khipu payment button and both payment intents', () => {
    const text = mount(Pagar).text();

    expect(text).toContain('Pagar cuota o donar');
    expect(text).toContain('Cuota anual 2027');
    expect(text).toContain('Donación voluntaria');
    expect(text).toContain('Pagar con Khipu');
    expect(text).toContain('Monto mínimo');
  });

  it('should prefill the annual fee type, amount and show the student field', () => {
    const wrapper = mount(Pagar);
    const cuota = wrapper.find('#pago-tipo-cuota')
      .element as HTMLInputElement;
    const monto = wrapper.find('#pago-monto').element as HTMLInputElement;

    expect(cuota.checked).toBe(true);
    expect(monto.value).toBe('10000');
    expect(wrapper.find('#pago-estudiante').exists()).toBe(true);
  });

  it('should hide the student field when the payer selects a donation', async () => {
    const wrapper = mount(Pagar);

    await wrapper.find('#pago-tipo-donacion').setValue();

    expect(wrapper.find('#pago-estudiante').exists()).toBe(false);
    expect(wrapper.text()).toContain('Monto libre desde');
  });

  it('should not call the API when the form is invalid', async () => {
    const wrapper = mount(Pagar);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Indica tu nombre completo.');
  });

  it('should create the annual fee and redirect to the Khipu portal', async () => {
    const wrapper = mount(Pagar);

    await fillValidForm(wrapper, { estudiante: '3° Básico A' });
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).toHaveBeenCalledWith('/pagos/khipu', {
      tipo_aporte: 'CUOTA_ANUAL',
      monto: 25000,
      pagador_email: 'apoderado@ejemplo.cl',
      pagador_nombre: 'Juan Pérez',
      estudiante: '3° Básico A',
    });
    expect(mockRedirect).toHaveBeenCalledWith(
      'https://khipu.com/payment/info/abc123',
    );
  });

  it('should create a donation without the student field', async () => {
    const wrapper = mount(Pagar);

    await wrapper.find('#pago-tipo-donacion').setValue();
    await fillValidForm(wrapper, { monto: '5000' });
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).toHaveBeenCalledWith('/pagos/khipu', {
      tipo_aporte: 'DONACION',
      monto: 5000,
      pagador_email: 'apoderado@ejemplo.cl',
      pagador_nombre: 'Juan Pérez',
    });
  });

  it('should show an error when the API rejects the request', async () => {
    mockPost.mockRejectedValueOnce(new Error('network'));
    const wrapper = mount(Pagar);

    await fillValidForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('No pudimos iniciar el pago');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('should show an error when the response has no payment url', async () => {
    mockPost.mockResolvedValueOnce({ data: {} });
    const wrapper = mount(Pagar);

    await fillValidForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('No pudimos iniciar el pago');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('should reject an amount with thousand separators', async () => {
    const wrapper = mount(Pagar);

    await wrapper.find('#pago-nombre').setValue('Juan Pérez');
    await wrapper.find('#pago-email').setValue('apoderado@ejemplo.cl');
    await wrapper.find('#pago-monto').setValue('25.000');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('sin puntos ni decimales');
  });
});
