import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mockGet = vi.fn();
const routeQuery = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock('../plugins/axios', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
  RouterLink: {
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
    props: ['to'],
  },
}));

import PagoConfirmacion from './PagoConfirmacion.vue';

const POLL_INTERVAL_MS = 3000;

function makePago(overrides: Record<string, unknown> = {}) {
  return {
    transaction_id: 'CGPA-PAY-2026-ABC123',
    asunto: 'CGPA - Cuota anual 2026',
    moneda: 'CLP',
    monto: 25000,
    estado: 'PENDIENTE',
    creado_en: new Date(),
    actualizado_en: new Date(),
    ...overrides,
  };
}

describe('PagoConfirmacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeQuery.value = { transaction_id: 'CGPA-PAY-2026-ABC123' };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should explain when the transaction id is missing', async () => {
    routeQuery.value = {};

    const wrapper = mount(PagoConfirmacion);
    await flushPromises();

    expect(mockGet).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No encontramos el identificador del pago');
  });

  it('should query the status encoded in the URL', async () => {
    mockGet.mockResolvedValue({ data: makePago({ estado: 'PAGADO' }) });

    mount(PagoConfirmacion);
    await flushPromises();

    expect(mockGet).toHaveBeenCalledWith('/pagos/CGPA-PAY-2026-ABC123');
  });

  it('should show the confirmed payment details', async () => {
    mockGet.mockResolvedValue({
      data: makePago({
        estado: 'PAGADO',
        banco: 'Banco Estado',
        pagado_en: new Date('2026-11-02T16:09:00Z'),
      }),
    });

    const wrapper = mount(PagoConfirmacion);
    await flushPromises();

    expect(wrapper.text()).toContain('Pago confirmado');
    expect(wrapper.text()).toContain('$25.000');
    expect(wrapper.text()).toContain('Banco Estado');
    expect(wrapper.text()).toContain('CGPA-PAY-2026-ABC123');
  });

  it('should keep polling while the payment is pending', async () => {
    vi.useFakeTimers();
    mockGet
      .mockResolvedValueOnce({ data: makePago() })
      .mockResolvedValueOnce({ data: makePago({ estado: 'PAGADO' }) });

    const wrapper = mount(PagoConfirmacion);
    await flushPromises();

    expect(wrapper.text()).toContain(
      'pendiente de confirmación bancaria',
    );

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await flushPromises();

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('¡Pago confirmado!');
    wrapper.unmount();
  });

  it('should stop polling once the payment reaches a terminal state', async () => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue({ data: makePago({ estado: 'PAGADO' }) });

    const wrapper = mount(PagoConfirmacion);
    await flushPromises();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    await flushPromises();

    expect(mockGet).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('should show a cancelled payment message', async () => {
    mockGet.mockResolvedValue({ data: makePago({ estado: 'CANCELADO' }) });

    const wrapper = mount(PagoConfirmacion);
    await flushPromises();

    expect(wrapper.text()).toContain('Pago cancelado');
    expect(wrapper.text()).toContain('El pago no se completó');
  });

  it('should report a status query failure', async () => {
    mockGet.mockRejectedValue(new Error('network'));

    const wrapper = mount(PagoConfirmacion);
    await flushPromises();

    expect(wrapper.text()).toContain(
      'No pudimos consultar el estado del pago',
    );
  });

  it('should allow retrying the query manually', async () => {
    mockGet.mockResolvedValue({ data: makePago({ estado: 'PAGADO' }) });

    const wrapper = mount(PagoConfirmacion);
    await flushPromises();

    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Actualizar estado'))!
      .trigger('click');
    await flushPromises();

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('should stop polling after the maximum number of attempts', async () => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue({ data: makePago() });

    const wrapper = mount(PagoConfirmacion);
    await flushPromises();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 25);
    await flushPromises();

    expect(mockGet).toHaveBeenCalledTimes(20);
    expect(wrapper.text()).toContain('usa «Actualizar estado»');
    wrapper.unmount();
  });
});
