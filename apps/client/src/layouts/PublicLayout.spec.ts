import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

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
  RouterView: { template: '<div class="router-view" />' },
}));

import PublicLayout from './PublicLayout.vue';
import { ORGANIZATION, PENDING_LABEL } from '../content/institutional';
import { PUBLIC_ROUTES } from '../content/public-routes';

function mountLayout() {
  return mount(PublicLayout, {
    global: { stubs: { RouterView: { template: '<div class="router-view" />' } } },
  });
}

describe('PublicLayout', () => {
  it('should render the full legal name of the organization', () => {
    const wrapper = mountLayout();
    expect(wrapper.text()).toContain(ORGANIZATION.legalName);
  });

  it('should render the legal personality number and its status', () => {
    const text = mountLayout().text();

    expect(text).toContain('Personalidad Jurídica N° 242029');
    expect(text).toContain('31-05-2016');
    expect(text).toContain('Vigente');
  });

  it('should render the physical address of the organization', () => {
    const text = mountLayout().text();

    expect(text).toContain('San Ramón N° 2055');
    expect(text).toContain('Villarrica');
  });

  it('should render a navigation link for every public route', () => {
    const wrapper = mountLayout();
    const links = wrapper.findAll('a').map((link) => link.attributes('href'));

    for (const route of PUBLIC_ROUTES) {
      expect(links).toContain(route.path);
    }
  });

  it('should render the navigation labels of every public route', () => {
    const text = mountLayout().text();

    for (const route of PUBLIC_ROUTES) {
      expect(text).toContain(route.navLabel);
    }
  });

  it('should offer an access point for the board members', () => {
    const links = mountLayout()
      .findAll('a')
      .map((link) => link.attributes('href'));

    expect(links).toContain('/login');
  });

  it('should show the site root as the active route', () => {
    const wrapper = mountLayout();
    expect(wrapper.html()).toContain('active');
  });

  it('should mark the public contact channels as pending when undefined', () => {
    const text = mountLayout().text();

    expect(ORGANIZATION.contact.email).toBeNull();
    expect(text).toContain(PENDING_LABEL);
  });

  it('should render the current year in the footer', () => {
    const text = mountLayout().text();
    expect(text).toContain(String(new Date().getFullYear()));
  });

  it('should announce the official domain in the footer', () => {
    expect(mountLayout().text()).toContain('cgpagrahambell.cl');
  });
});
