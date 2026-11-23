import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface Header {
  key: string;
  value: string;
}

interface HostingConfig {
  hosting: {
    headers: Array<{ source: string; headers: Header[] }>;
  };
}

const firebaseConfig = JSON.parse(
  readFileSync(path.resolve(process.cwd(), '../../firebase.json'), 'utf8'),
) as HostingConfig;

function catchAllHeaders(): Header[] {
  return (
    firebaseConfig.hosting.headers.find((entry) => entry.source === '**')
      ?.headers ?? []
  );
}

function header(key: string): string | undefined {
  return catchAllHeaders().find((entry) => entry.key === key)?.value;
}

function directive(policy: string, name: string): string {
  return policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `)) ?? '';
}

describe('firebase.json hosting headers', () => {
  it('should publish the CSP in Report-Only mode', () => {
    const csp = header('Content-Security-Policy-Report-Only');

    expect(csp).toBeDefined();
    expect(header('Content-Security-Policy')).toBeUndefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('report-uri /api/csp-report');
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('should not allow inline or eval scripts', () => {
    const csp = header('Content-Security-Policy-Report-Only') ?? '';
    const scriptSrc = directive(csp, 'script-src');

    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain('https://challenges.cloudflare.com');
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('should keep the rest of the hardening headers', () => {
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(header('X-Frame-Options')).toBe('SAMEORIGIN');
  });
});
