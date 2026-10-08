import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

/**
 * Store simulado: la lista de movimientos solo necesita exponer el estado de
 * paginación que el componente consume.
 */
const finanzasStore = {
  transacciones: [] as Record<string, unknown>[],
  proyectos: [] as Record<string, unknown>[],
  loading: false,
  hasMoreTransactions: false,
  loadingMoreTransactions: false,
  loadMoreTransactions: vi.fn(),
};

vi.mock('../stores/finanzas', () => ({
  useFinanzasStore: () => finanzasStore,
}));

import TransactionList from './TransactionList.vue';

/** Crea una transacción con la forma mínima que el componente renderiza. */
function transaction(id: string) {
  return {
    id,
    tipo: 'INGRESO',
    monto: 500000,
    fecha: new Date('2026-08-01T10:00:00Z'),
    categoria: 'CUOTAS',
    descripcion: `Movimiento ${id}`,
    proyecto_id: undefined,
    hash_integridad: 'abc12345deadbeef',
    numero_secuencia: 12,
    respaldo_url: undefined,
  };
}

describe('TransactionList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finanzasStore.loading = false;
    finanzasStore.transacciones = [transaction('t1'), transaction('t2')];
    finanzasStore.hasMoreTransactions = false;
    finanzasStore.loadingMoreTransactions = false;
  });

  it('should render every transaction provided by the store', () => {
    const text = mount(TransactionList).text();

    expect(text).toContain('Movimiento t1');
    expect(text).toContain('Movimiento t2');
  });

  it('should offer to load more when the store reports pending transactions', () => {
    finanzasStore.hasMoreTransactions = true;

    expect(mount(TransactionList).text()).toContain('Cargar más movimientos');
  });

  it('should not offer to load more when the store has no pending transactions', () => {
    expect(mount(TransactionList).text()).not.toContain('Cargar más movimientos');
  });

  it('should request the next page when the load more button is clicked', async () => {
    finanzasStore.hasMoreTransactions = true;

    const wrapper = mount(TransactionList);
    await wrapper.find('button').trigger('click');

    expect(finanzasStore.loadMoreTransactions).toHaveBeenCalledTimes(1);
  });

  it('should disable the button and show a spinner while loading more', () => {
    finanzasStore.hasMoreTransactions = true;
    finanzasStore.loadingMoreTransactions = true;

    const wrapper = mount(TransactionList);
    const button = wrapper.find('button');

    expect(button.attributes('disabled')).toBeDefined();
    expect(button.text()).toContain('Cargando...');
    expect(wrapper.find('.loading-spinner').exists()).toBe(true);
  });

  it('should show the empty state when there are no transactions', () => {
    finanzasStore.transacciones = [];

    expect(mount(TransactionList).text()).toContain(
      'No hay movimientos registrados.',
    );
  });
});
