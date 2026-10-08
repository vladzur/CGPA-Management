import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const finanzasStore = {
  institucion: {
    nombre: 'Centro General de Padres AGB',
    periodo_actual: '2026',
    saldo_total: 1250000,
    ultima_actualizacion: new Date('2026-08-01T10:00:00Z'),
  } as Record<string, unknown> | null,
  proyectos: [] as unknown[],
  transacciones: [] as unknown[],
  loading: false,
  hasMoreTransactions: false,
  loadingMoreTransactions: false,
  loadMoreTransactions: vi.fn(),
  init: vi.fn(),
  cleanup: vi.fn(),
};

vi.mock('../stores/finanzas', () => ({
  useFinanzasStore: () => finanzasStore,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/transparencia',
    hash: '',
    name: 'Transparency',
    params: {},
    query: {},
    matched: [],
    meta: {},
    fullPath: '/transparencia',
  }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
    props: ['to'],
  },
  RouterView: { template: '<div />' },
}));

import Transparency from './Transparency.vue';

const TRANSACTIONS = [
  {
    id: 't1',
    tipo: 'INGRESO' as const,
    monto: 500000,
    fecha: new Date('2026-08-01T10:00:00Z'),
    categoria: 'CUOTAS',
    descripcion: 'Cuotas de agosto',
    estado: 'CONCILIADO' as const,
    registrado_por: { uid: 'u1', nombre: 'Tesorería' },
    hash_integridad: 'abc123',
    numero_secuencia: 12,
    respaldo_url: 'https://example.cl/boleta.pdf',
  },
  {
    id: 't2',
    tipo: 'EGRESO' as const,
    monto: 150000,
    fecha: new Date('2026-07-20T10:00:00Z'),
    categoria: 'MATERIALES',
    descripcion: 'Compra de pinturas',
    estado: 'CONCILIADO' as const,
    registrado_por: { uid: 'u1', nombre: 'Tesorería' },
  },
];

describe('Transparency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finanzasStore.loading = false;
    finanzasStore.transacciones = TRANSACTIONS;
    finanzasStore.hasMoreTransactions = false;
    finanzasStore.loadingMoreTransactions = false;
  });

  it('should render the available balance of the general fund', () => {
    expect(mount(Transparency).text()).toContain('1.250.000');
  });

  it('should explain what information is published and how often', () => {
    const text = mount(Transparency).text();

    expect(text).toContain('Qué publicamos');
    expect(text).toContain('Con qué periodicidad');
    expect(text).toContain('Cómo se verifica');
  });

  it('should list every published movement', () => {
    const text = mount(Transparency).text();

    expect(text).toContain('Cuotas de agosto');
    expect(text).toContain('Compra de pinturas');
  });

  it('should show income amounts as positive and expenses as negative', () => {
    const html = mount(Transparency).html();

    expect(html).toContain('+');
    expect(html).toContain('-');
    expect(html).toContain('500.000');
    expect(html).toContain('150.000');
  });

  it('should flag movements carrying a cryptographic seal as verified', () => {
    const text = mount(Transparency).text();

    expect(text).toContain('Verificado');
    expect(text).toContain('Sin respaldo adjunto');
  });

  it('should link the supporting document when available', () => {
    const links = mount(Transparency)
      .findAll('a')
      .map((link) => link.attributes('href'));

    expect(links).toContain('https://example.cl/boleta.pdf');
  });

  it('should filter the movements by type', async () => {
    const wrapper = mount(Transparency);

    const incomeButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Ingresos');
    await incomeButton!.trigger('click');

    const text = wrapper.text();
    expect(text).toContain('Cuotas de agosto');
    expect(text).not.toContain('Compra de pinturas');
  });

  it('should restore every movement when the filter is cleared', async () => {
    const wrapper = mount(Transparency);

    const expenseButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Egresos');
    await expenseButton!.trigger('click');

    const allButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Todos');
    await allButton!.trigger('click');

    const text = wrapper.text();
    expect(text).toContain('Cuotas de agosto');
    expect(text).toContain('Compra de pinturas');
  });

  it('should subscribe and unlink the financial data subscription', () => {
    const wrapper = mount(Transparency);
    expect(finanzasStore.init).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(finanzasStore.cleanup).toHaveBeenCalledTimes(1);
  });

  it('should describe the empty filter result without placeholder wording', () => {
    finanzasStore.transacciones = [];

    const text = mount(Transparency).text();

    expect(text).toContain('No hay movimientos para mostrar');
    expect(text).not.toMatch(/en construcción|próximamente/i);
  });

  it('should link to the related public sections', () => {
    const links = mount(Transparency)
      .findAll('a')
      .map((link) => link.attributes('href'));

    expect(links).toEqual(
      expect.arrayContaining(['/proyectos', '/comunicados', '/nosotros']),
    );
  });

  it('should offer to load older movements when the store reports pending transactions', () => {
    finanzasStore.hasMoreTransactions = true;

    expect(mount(Transparency).text()).toContain('Cargar más movimientos');
  });

  it('should not offer to load older movements when the store has no pending transactions', () => {
    expect(mount(Transparency).text()).not.toContain('Cargar más movimientos');
  });

  it('should request the next page when the load more button is clicked', async () => {
    finanzasStore.hasMoreTransactions = true;

    const wrapper = mount(Transparency);
    const button = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('Cargar más movimientos'));
    await button!.trigger('click');

    expect(finanzasStore.loadMoreTransactions).toHaveBeenCalledTimes(1);
  });

  it('should disable the button and show a spinner while loading more', () => {
    finanzasStore.hasMoreTransactions = true;
    finanzasStore.loadingMoreTransactions = true;

    const wrapper = mount(Transparency);
    const button = wrapper
      .findAll('button')
      .find((candidate) => candidate.text().includes('Cargando...'));

    expect(button).toBeDefined();
    expect(button!.attributes('disabled')).toBeDefined();
    expect(wrapper.find('.loading-spinner').exists()).toBe(true);
  });
});
