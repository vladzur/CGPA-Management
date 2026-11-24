import { Logger } from '@nestjs/common';
import { CspReportService } from './csp-report.service';

describe('CspReportService', () => {
  let service: CspReportService;

  beforeEach(() => {
    service = new CspReportService();
  });

  afterEach(() => jest.restoreAllMocks());

  it('should extract the directive from the legacy csp-report body', () => {
    expect(
      service.extractDirective({
        'csp-report': {
          'document-uri': 'https://cgpagrahambell.cl/',
          'violated-directive': "script-src 'self'",
        },
      }),
    ).toBe("script-src 'self'");
  });

  it('should extract the directive from the Reporting API body', () => {
    expect(
      service.extractDirective([
        {
          type: 'csp-violation',
          body: { effectiveDirective: 'img-src', blockedURL: 'https://x.test' },
        },
      ]),
    ).toBe('img-src');
  });

  it('should return null for unknown or unbounded directives', () => {
    expect(service.extractDirective(null)).toBeNull();
    expect(service.extractDirective({ otra: 'cosa' })).toBeNull();
    expect(
      service.extractDirective({ 'violated-directive': 'x'.repeat(500) }),
    ).toBeNull();
  });

  it('should allow 60 reports per minute and reject the next one', () => {
    const now = 1_000_000;

    for (let i = 0; i < 60; i += 1) {
      expect(service.consume('203.0.113.10', now).allowed).toBe(true);
    }

    const blocked = service.consume('203.0.113.10', now);

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('should start a new window after a minute', () => {
    const now = 2_000_000;

    for (let i = 0; i < 60; i += 1) {
      service.consume('203.0.113.11', now);
    }

    expect(service.consume('203.0.113.11', now + 60_000).allowed).toBe(true);
  });

  it('should log only the directive and never the payload', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    service.logReport({
      'csp-report': {
        'document-uri': 'https://cgpagrahambell.cl/validar/abc',
        'violated-directive': 'script-src',
      },
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('script-src');
    expect(warn.mock.calls[0][0]).not.toContain('validar/abc');
  });
});
