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

async function fillValidForm(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('#pago-nombre').setValue('Juan Pérez');
  await wrapper.find('#pago-email').setValue('apoderado@ejemplo.cl');
  await wrapper.find('#pago-monto').setValue('25000');
}

describe('Pagar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({
      data: { payment_url: 'https://khipu.com/payment/info/abc123' },
    });
  });

  it('should render the Khipu payment button', () => {
    const text = mount(Pagar).text();

    expect(text).toContain('Pagar con Khipu');
    expect(text).toContain('Monto mínimo');
  });

  it('should prefill the concept and the amount of the current fee', () => {
    const wrapper = mount(Pagar);
    const concepto = wrapper.find('#pago-concepto')
      .element as HTMLInputElement;
    const monto = wrapper.find('#pago-monto').element as HTMLInputElement;

    expect(concepto.value).toBe('Cuota anual 2027');
    expect(monto.value).toBe('10000');
  });

  it('should not call the API when the form is invalid', async () => {
    const wrapper = mount(Pagar);

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Indica tu nombre completo.');
  });

  it('should create the payment and redirect to the Khipu portal', async () => {
    const wrapper = mount(Pagar);

    await fillValidForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).toHaveBeenCalledWith('/pagos/khipu', {
      concepto: 'Cuota anual 2027',
      monto: 25000,
      pagador_email: 'apoderado@ejemplo.cl',
      pagador_nombre: 'Juan Pérez',
    });
    expect(mockRedirect).toHaveBeenCalledWith(
      'https://khipu.com/payment/info/abc123',
    );
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
