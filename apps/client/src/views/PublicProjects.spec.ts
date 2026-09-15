import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const finanzasStore = {
  institucion: null as Record<string, unknown> | null,
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
    path: '/proyectos',
    hash: '',
    name: 'PublicProjects',
    params: {},
    query: {},
    matched: [],
    meta: {},
    fullPath: '/proyectos',
  }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
    props: ['to'],
  },
  RouterView: { template: '<div />' },
}));

import PublicProjects from './PublicProjects.vue';
import { ORGANIZATION } from '../content/institutional';

const PROJECTS = [
  {
    id: 'p1',
    nombre: 'Patio techado',
    descripcion: 'Construcción de un patio techado para los estudiantes.',
    estado: 'EN_CURSO' as const,
    presupuesto_estimado: 1000000,
    monto_recaudado: 600000,
    monto_ejecutado: 250000,
    fecha_inicio: new Date('2026-03-01T10:00:00Z'),
    responsable: { uid: 'u1', nombre: 'Directiva' },
  },
  {
    id: 'p2',
    nombre: 'Material didáctico',
    descripcion: 'Compra de material didáctico para enseñanza básica.',
    estado: 'FINALIZADO' as const,
    presupuesto_estimado: 500000,
    monto_recaudado: 500000,
    monto_ejecutado: 480000,
    fecha_inicio: new Date('2026-01-15T10:00:00Z'),
    responsable: { uid: 'u1', nombre: 'Directiva' },
  },
];

describe('PublicProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    finanzasStore.loading = false;
    finanzasStore.proyectos = PROJECTS;
  });

  it('should list every published project', () => {
    const wrapper = mount(PublicProjects);

    expect(wrapper.text()).toContain('Patio techado');
    expect(wrapper.text()).toContain('Material didáctico');
  });

  it('should describe each project', () => {
    expect(mount(PublicProjects).text()).toContain(
      'Construcción de un patio techado para los estudiantes.',
    );
  });

  it('should translate the project status into a readable label', () => {
    const text = mount(PublicProjects).text();

    expect(text).toContain('En curso');
    expect(text).toContain('Finalizado');
  });

  it('should show the budget, the collected amount and the executed amount per project', () => {
    const text = mount(PublicProjects).text();

    expect(text).toContain('1.000.000');
    expect(text).toContain('600.000');
    expect(text).toContain('250.000');
  });

  it('should compute the budget execution percentage', () => {
    expect(mount(PublicProjects).text()).toContain('25%');
  });

  it('should summarise the totals across projects', () => {
    const text = mount(PublicProjects).text();

    // Presupuesto 1.000.000 + 500.000
    expect(text).toContain('1.500.000');
    // Recaudado 600.000 + 500.000
    expect(text).toContain('1.100.000');
    // Ejecutado 250.000 + 480.000
    expect(text).toContain('730.000');
  });

  it('should subscribe to the financial store on mount', () => {
    mount(PublicProjects);

    expect(finanzasStore.init).toHaveBeenCalledTimes(1);
  });

  it('should unlink the subscription when unmounted', () => {
    const wrapper = mount(PublicProjects);
    wrapper.unmount();

    expect(finanzasStore.cleanup).toHaveBeenCalledTimes(1);
  });

  it('should explain the empty state instead of showing a placeholder', () => {
    finanzasStore.proyectos = [];

    const text = mount(PublicProjects).text();

    expect(text).toContain('Aún no hay proyectos publicados');
    expect(text).toContain(ORGANIZATION.currentPeriod);
    expect(text).not.toMatch(/en construcción|próximamente/i);
  });

  it('should explain how the projects are financed', () => {
    expect(mount(PublicProjects).text()).toMatch(/cuota anual de apoderados/i);
  });
});
