// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('should render regular Markdown', () => {
    const html = renderMarkdown('# Título\n\n**Negrita** y [sitio](https://cgpagrahambell.cl)');

    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<strong>Negrita</strong>');
    expect(html).toContain('href="https://cgpagrahambell.cl"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('should remove script tags', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\nTexto');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert(1)');
    expect(html).toContain('Texto');
  });

  it('should strip event handlers from images', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');

    expect(html).not.toContain('onerror');
    expect(html).not.toContain('alert(1)');
  });

  it('should remove javascript links', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('alert(1)');
  });

  it('should remove iframes and svg payloads', () => {
    const html = renderMarkdown(
      '<iframe src="https://evil.example"></iframe>\n\n<svg onload=alert(1)></svg>',
    );

    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('onload');
  });

  it('should drop data and insecure image sources', () => {
    const dataImage = renderMarkdown(
      '![x](data:image/png;base64,iVBORw0KGgo=)',
    );
    const insecureImage = renderMarkdown('![x](http://example.com/a.png)');
    const secureImage = renderMarkdown('![x](https://example.com/a.png)');

    expect(dataImage).not.toContain('data:image');
    expect(insecureImage).not.toContain('example.com');
    expect(secureImage).toContain('https://example.com/a.png');
  });

  it('should keep relative images from the site', () => {
    const html = renderMarkdown('![Logo](/logo-cgpa.png)');

    expect(html).toContain('src="/logo-cgpa.png"');
  });
});
