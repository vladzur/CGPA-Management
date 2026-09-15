import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/nosotros',
    hash: '',
    name: 'About',
    params: {},
    query: {},
    matched: [],
    meta: {},
    fullPath: '/nosotros',
  }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
    props: ['to'],
  },
  RouterView: { template: '<div />' },
}));

import About from './About.vue';
import {
  BOARD_MEMBERS,
  BOARD_METADATA,
  HISTORY,
  MISSION,
  OBJECTIVES,
  ORGANIZATION,
  PROGRAMS,
  VISION,
} from '../content/institutional';

describe('About', () => {
  it('should render the mission and the vision', () => {
    const text = mount(About).text();

    expect(text).toContain(MISSION);
    expect(text).toContain(VISION);
  });

  it('should render every objective', () => {
    const text = mount(About).text();

    for (const objective of OBJECTIVES) {
      expect(text).toContain(objective);
    }
  });

  it('should render every program and service', () => {
    const text = mount(About).text();

    for (const program of PROGRAMS) {
      expect(text).toContain(program.title);
      expect(text).toContain(program.description);
    }
  });

  it('should render the institutional history', () => {
    expect(mount(About).text()).toContain(HISTORY);
  });

  it('should render the full legal identification of the organization', () => {
    const text = mount(About).text();

    expect(text).toContain(ORGANIZATION.legalName);
    expect(text).toContain('242029');
    expect(text).toContain('31-05-2016');
    expect(text).toContain(ORGANIZATION.legalPersonality.registry);
    expect(text).toContain(ORGANIZATION.legalPersonality.status);
    expect(text).toContain('San Ramón N° 2055');
  });

  it('should render the role and the name of every board member', () => {
    const text = mount(About).text();

    for (const member of BOARD_MEMBERS) {
      expect(text).toContain(member.role);
      expect(text).toContain(member.name);
    }
  });

  it('should expose the board section anchor for direct linking', () => {
    expect(mount(About).html()).toContain('id="directiva"');
  });

  it('should document the board election date and term', () => {
    const text = mount(About).text();

    expect(text).toContain(BOARD_METADATA.lastElection);
    expect(text).toContain(BOARD_METADATA.term);
  });

  it('should state that board members personal data is not published', () => {
    const text = mount(About).text();

    expect(text).toMatch(/datos personales/i);
    expect(text).not.toMatch(/\d{1,2}\.\d{3}\.\d{3}-[\dkK]/);
  });

  it('should offer links to the other public sections', () => {
    const links = mount(About)
      .findAll('a')
      .map((link) => link.attributes('href'));

    expect(links).toEqual(
      expect.arrayContaining([
        '/proyectos',
        '/transparencia',
        '/comunicados',
        '/contacto',
      ]),
    );
  });
});
