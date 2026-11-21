import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const routeQuery = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
  RouterLink: {
    template: '<a :href="typeof to === \'string\' ? to : \'#\'"><slot /></a>',
    props: ['to'],
  },
}));

import PagoCancelado from './PagoCancelado.vue';

describe('PagoCancelado', () => {
  it('should offer a way back to the payment form', () => {
    routeQuery.value = { transaction_id: 'CGPA-PAY-2026-ABC123' };

    const wrapper = mount(PagoCancelado);
    const text = wrapper.text();

    expect(text).toContain('Pago cancelado');
    expect(text).toContain('CGPA-PAY-2026-ABC123');
    expect(wrapper.html()).toContain('href="/pagar"');
  });

  it('should hide the reference when it is not provided', () => {
    routeQuery.value = {};

    const text = mount(PagoCancelado).text();

    expect(text).not.toContain('Referencia del intento');
  });
});
