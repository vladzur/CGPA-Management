import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('../../plugins/axios', () => ({
  default: { get: mockGet },
}));

import AdminPagos from './AdminPagos.vue';

function makePago(overrides: Record<string, unknown> = {}) {
  return {
    id: 'CGPA-PAY-2026-ABC123',
    transaction_id: 'CGPA-PAY-2026-ABC123',
    proveedor: 'khipu',
    referencia_externa: 'abc123xyz456',
    asunto: 'CGPA - Cuota anual 2027',
    moneda: 'CLP',
    monto: 10000,
    pagador_email: 'apoderado@ejemplo.cl',
    pagador_nombre: 'Juan Pérez',
    tipo_aporte: 'CUOTA_ANUAL',
    periodo: 2027,
    estudiante: '3° Básico A',
    estado: 'PAGADO',
    estado_detalle: 'normal',
    banco: 'Banco Estado',
    creado_en: new Date('2026-11-02T16:09:00Z'),
    actualizado_en: new Date('2026-11-02T16:09:00Z'),
    ...overrides,
  };
}

describe('AdminPagos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: [makePago()] });
  });

  it('should load the payments from the admin endpoint', async () => {
    const wrapper = mount(AdminPagos);
    await flushPromises();

    expect(mockGet).toHaveBeenCalledWith('/pagos');
    expect(wrapper.text()).toContain('Pagos recibidos');
    expect(wrapper.text()).toContain('$10.000');
    expect(wrapper.text()).toContain('Juan Pérez');
    expect(wrapper.text()).toContain('Banco Estado');
    expect(wrapper.text()).toContain('Cuota anual');
    expect(wrapper.text()).toContain('3° Básico A');
    expect(wrapper.text()).toContain('CGPA-PAY-2026-ABC123');
  });

  it('should add up only the confirmed payments', async () => {
    mockGet.mockResolvedValue({
      data: [
        makePago({ id: 'a', monto: 10000 }),
        makePago({ id: 'b', monto: 5000 }),
        makePago({ id: 'c', monto: 7000, estado: 'PENDIENTE' }),
      ],
    });

    const wrapper = mount(AdminPagos);
    await flushPromises();

    expect(wrapper.text()).toContain('$15.000');
  });

  it('should filter by type and state', async () => {
    mockGet.mockResolvedValue({
      data: [
        makePago({ id: 'cuota', pagador_nombre: 'Apoderado Cuota' }),
        makePago({
          id: 'donacion',
          tipo_aporte: 'DONACION',
          estado: 'PENDIENTE',
          asunto: 'CGPA - Donación voluntaria',
          pagador_nombre: 'Donante Voluntario',
          monto: 5000,
        }),
      ],
    });

    const wrapper = mount(AdminPagos);
    await flushPromises();

    const selects = wrapper.findAll('select');
    await selects[0].setValue('DONACION');

    expect(wrapper.text()).not.toContain('Apoderado Cuota');
    expect(wrapper.text()).toContain('Donante Voluntario');

    await selects[1].setValue('PENDIENTE');

    expect(wrapper.text()).toContain('Donante Voluntario');
    expect(wrapper.text()).toContain('$5.000');
  });

  it('should show an empty state when there are no payments', async () => {
    mockGet.mockResolvedValue({ data: [] });

    const wrapper = mount(AdminPagos);
    await flushPromises();

    expect(wrapper.text()).toContain('No hay pagos para mostrar');
  });

  it('should show the backend error message', async () => {
    mockGet.mockRejectedValue({
      response: { data: { message: 'Sin permiso' } },
    });

    const wrapper = mount(AdminPagos);
    await flushPromises();

    expect(wrapper.text()).toContain('Sin permiso');
  });

  it('should reload the payments with the refresh button', async () => {
    const wrapper = mount(AdminPagos);
    await flushPromises();

    const refresh = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Actualizar'))!;
    await refresh.trigger('click');
    await flushPromises();

    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
