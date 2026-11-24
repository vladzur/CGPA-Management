import { BadRequestException } from '@nestjs/common';
import { MarkdownPolicyService } from './markdown-policy.service';

describe('MarkdownPolicyService', () => {
  let service: MarkdownPolicyService;

  beforeEach(() => {
    service = new MarkdownPolicyService();
  });

  it('should return no violations for valid Markdown', () => {
    expect(service.validate('# Título\n\nTexto')).toEqual([]);
    expect(() => service.assertValid('# Título\n\nTexto')).not.toThrow();
  });

  it('should reject raw HTML with a 400 that explains the policy', () => {
    expect(() =>
      service.assertValid('<img src=x onerror=alert(1)>'),
    ).toThrow(BadRequestException);

    try {
      service.assertValid('<script>alert(1)</script>');
    } catch (error: any) {
      expect(error.response.message).toContain('política de Markdown');
      expect(Array.isArray(error.response.errors)).toBe(true);
    }
  });
});
