import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mockGet = vi.fn();

vi.mock('../plugins/axios', () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

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
  init: vi.fn(),
  cleanup: vi.fn(),
};

vi.mock('../stores/finanzas', () => ({
  useFinanzasStore: () => finanzasStore,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/',
    hash: '',
    name: 'Home',
    params: {},
    query: {},
    matched: [],
    meta: {},
    fullPath: '/',
  }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
    props: ['to'],
  },
  RouterView: { template: '<div />' },
}));

import Home from './Home.vue';
import { MISSION, ORGANIZATION, PROGRAMS } from '../content/institutional';

const ANNOUNCEMENTS = [
  {
    id: 'c1',
    titulo: 'Reunión de apoderados',
    contenido: 'Se cita a reunión el próximo martes.',
    fecha_publicacion: new Date('2026-08-10T10:00:00Z'),
  },
  {
    id: 'c2',
    titulo: 'Inicio de obras',
    contenido: 'Comienzan las obras del patio techado.',
    fecha_publicacion: new Date('2026-08-05T10:00:00Z'),
  },
  {
    id: 'c3',
    titulo: 'Pago de cuota',
    contenido: 'Recordatorio del pago de la cuota anual.',
    fecha_publicacion: new Date('2026-08-01T10:00:00Z'),
  },
  {
    id: 'c4',
    titulo: 'Cuarto comunicado',
    contenido: 'Este comunicado no debería listarse en la portada.',
    fecha_publicacion: new Date('2026-07-01T10:00:00Z'),
  },
];

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finanzasStore.loading = false;
    finanzasStore.institucion = {
      nombre: 'Centro General de Padres AGB',
      periodo_actual: '2026',
      saldo_total: 1250000,
      ultima_actualizacion: new Date('2026-08-01T10:00:00Z'),
    };
    mockGet.mockResolvedValue({ data: ANNOUNCEMENTS });
  });

  it('should render the legal name and acronym of the organization', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    expect(wrapper.text()).toContain(ORGANIZATION.legalName);
    expect(wrapper.text()).toContain(ORGANIZATION.shortName);
  });

  it('should render the mission statement', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    expect(wrapper.text()).toContain(MISSION);
  });

  it('should render the legal personality number and status', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    expect(wrapper.text()).toContain('242029');
    expect(wrapper.text()).toContain(ORGANIZATION.legalPersonality.status);
  });

  it('should render the physical address', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    expect(wrapper.text()).toContain('San Ramón N° 2055');
  });

  it('should render every declared program', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    for (const program of PROGRAMS) {
      expect(wrapper.text()).toContain(program.title);
    }
  });

  it('should start and stop the financial data subscription', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    expect(finanzasStore.init).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    expect(finanzasStore.cleanup).toHaveBeenCalledTimes(1);
  });

  it('should render the available balance formatted in chilean pesos', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    expect(wrapper.text()).toContain('1.250.000');
  });

  it('should link to the transparency section', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    const links = wrapper.findAll('a').map((link) => link.attributes('href'));
    expect(links).toContain('/transparencia');
  });

  it('should request the published announcements', async () => {
    mount(Home);
    await flushPromises();

    expect(mockGet).toHaveBeenCalledWith('/comunicados/publicos');
  });

  it('should show at most the three most recent announcements', async () => {
    const wrapper = mount(Home);
    await flushPromises();

    expect(wrapper.text()).toContain('Reunión de apoderados');
    expect(wrapper.text()).toContain('Inicio de obras');
    expect(wrapper.text()).toContain('Pago de cuota');
    expect(wrapper.text()).not.toContain('Cuarto comunicado');
  });

  it('should keep rendering the page when the announcements request fails', async () => {
    mockGet.mockRejectedValue(new Error('sin conexión'));

    const wrapper = mount(Home);
    await flushPromises();

    expect(wrapper.text()).toContain(ORGANIZATION.legalName);
    expect(wrapper.text()).toContain('Comunicados');
  });
});
