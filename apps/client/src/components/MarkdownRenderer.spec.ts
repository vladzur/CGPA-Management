// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MarkdownRenderer from './MarkdownRenderer.vue';

describe('MarkdownRenderer.vue', () => {
  it('should not execute malicious HTML from an announcement', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content:
          '<img src=x onerror=alert(1)>\n\n<script>window.__xss = true</script>\n\nTexto seguro',
      },
    });

    const html = wrapper.html();

    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
    expect(html).toContain('Texto seguro');
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined();
  });

  it('should render regular Markdown content', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: '# Comunicado\n\nContenido **oficial**' },
    });

    expect(wrapper.find('h1').text()).toBe('Comunicado');
    expect(wrapper.find('strong').text()).toBe('oficial');
  });
});
