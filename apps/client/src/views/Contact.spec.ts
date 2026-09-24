import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mockPost = vi.fn();

vi.mock('../plugins/axios', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    path: '/contacto',
    hash: '',
    name: 'Contact',
    params: {},
    query: {},
    matched: [],
    meta: {},
    fullPath: '/contacto',
  }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
    props: ['to'],
  },
  RouterView: { template: '<div />' },
}));

import Contact from './Contact.vue';
import { ORGANIZATION, PENDING_LABEL } from '../content/institutional';

async function fillValidForm(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('#contact-name').setValue('Ana Apoderada');
  await wrapper.find('#contact-email').setValue('ana@example.cl');
  await wrapper.find('#contact-message').setValue(
    'Consulta sobre el pago de la cuota anual del período.',
  );
  await wrapper.find('input[type="checkbox"]').setValue(true);
}

describe('Contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPost.mockResolvedValue({ data: { id: 'msg-1' } });
  });

  it('should render the registered address of the organization', () => {
    const text = mount(Contact).text();

    expect(text).toContain('Francisco Bilbao 1202');
    expect(text).toContain('Villarrica');
  });

  it('should render the legal identity of the organization', () => {
    const text = mount(Contact).text();

    expect(text).toContain('242029');
    expect(text).toContain(ORGANIZATION.legalName);
  });

  it('should render the institutional email as the only direct contact channel', () => {
    const text = mount(Contact).text();

    // El correo es el único canal directo publicado: el teléfono no se publica.
    expect(ORGANIZATION.contact.phone).toBeNull();
    expect(text).toContain('contacto@cgpagrahambell.cl');
    expect(text).not.toContain(PENDING_LABEL);
  });

  it('should offer every enquiry reason declared in the shared model', () => {
    const options = mount(Contact)
      .findAll('option')
      .map((option) => option.text());

    expect(options).toEqual(
      expect.arrayContaining([
        'Consulta general',
        'Cuotas y pagos',
        'Proyectos y actividades',
        'Postulación a beneficios',
        'Otro',
      ]),
    );
  });

  it('should expose an accessible field for every required input', () => {
    const html = mount(Contact).html();

    expect(html).toContain('id="contact-name"');
    expect(html).toContain('id="contact-email"');
    expect(html).toContain('id="contact-reason"');
    expect(html).toContain('id="contact-message"');
  });

  it('should send the message payload to the public endpoint', async () => {
    const wrapper = mount(Contact);
    await fillValidForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).toHaveBeenCalledWith(
      '/mensajes',
      expect.objectContaining({
        nombre: 'Ana Apoderada',
        email: 'ana@example.cl',
        motivo: 'CONSULTA_GENERAL',
      }),
    );
  });

  it('should confirm the submission to the user', async () => {
    const wrapper = mount(Contact);
    await fillValidForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Recibimos tu mensaje');
  });

  it('should clear the form after a successful submission', async () => {
    const wrapper = mount(Contact);
    await fillValidForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const nameInput = wrapper.find('#contact-name')
      .element as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });

  it('should not call the endpoint when the form is incomplete', async () => {
    const wrapper = mount(Contact);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/nombre completo/i);
    expect(wrapper.text()).toMatch(/correo electrónico válido/i);
  });

  it('should report an unsubmitted consent', async () => {
    const wrapper = mount(Contact);
    await wrapper.find('#contact-name').setValue('Ana Apoderada');
    await wrapper.find('#contact-email').setValue('ana@example.cl');
    await wrapper.find('#contact-message').setValue(
      'Consulta sobre el pago de la cuota anual del período.',
    );
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/autorizar el uso de tus datos/i);
  });

  it('should inform the user when the endpoint fails', async () => {
    mockPost.mockRejectedValue(new Error('500'));

    const wrapper = mount(Contact);
    await fillValidForm(wrapper);
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('No pudimos enviar tu mensaje');
  });

  it('should silently discard submissions that filled the honeypot field', async () => {
    const wrapper = mount(Contact);
    await fillValidForm(wrapper);
    await wrapper.find('#contact-website').setValue('http://spam.example');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain('Recibimos tu mensaje');
  });
});
