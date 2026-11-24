import { findMarkdownPolicyViolations } from './markdown-policy';

describe('findMarkdownPolicyViolations', () => {
  it('should accept regular Markdown', () => {
    const markdown = [
      '# Título',
      '',
      'Un párrafo con **negrita**, *cursiva* y `código`.',
      '',
      '- Elemento',
      '',
      '[Sitio del CGPA](https://cgpagrahambell.cl)',
      '',
      '![Logo](/logo-cgpa.png)',
    ].join('\n');

    expect(findMarkdownPolicyViolations(markdown)).toEqual([]);
  });

  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<iframe src="https://evil.example"></iframe>',
    '<svg onload=alert(1)></svg>',
    '<div style="position:fixed">Contenido</div>',
  ])('should reject raw HTML: %s', (markdown) => {
    expect(findMarkdownPolicyViolations(markdown).length).toBeGreaterThan(0);
  });

  it.each([
    '[click](javascript:alert(1))',
    '[click](data:text/html;base64,PHNjcmlwdD4=)',
    '[click](vbscript:msgbox(1))',
  ])('should reject unsafe link protocols: %s', (markdown) => {
    const violations = findMarkdownPolicyViolations(markdown);

    expect(violations.some((violation) => violation.message.includes('http'))).toBe(
      true,
    );
  });

  it('should allow mailto links', () => {
    expect(
      findMarkdownPolicyViolations('[Escríbenos](mailto:contacto@cgpagrahambell.cl)'),
    ).toEqual([]);
  });

  it('should reject insecure image protocols', () => {
    const violations = findMarkdownPolicyViolations(
      '![Logo](http://example.com/logo.png)',
    );

    expect(violations.some((violation) => violation.message.includes('https'))).toBe(
      true,
    );
  });

  it('should allow relative image paths', () => {
    expect(findMarkdownPolicyViolations('![Logo](/logo-cgpa.png)')).toEqual([]);
  });
});
