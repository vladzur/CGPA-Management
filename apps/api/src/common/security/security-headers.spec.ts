import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureSecurityHeaders, securityHeaders } from './security-headers';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController] })
class SecurityHeadersTestModule {}

describe('securityHeaders', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SecurityHeadersTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.disable('x-powered-by');
    configureSecurityHeaders(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should apply restrictive headers and hide the server stack', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers['strict-transport-security']).toContain(
      'max-age=31536000',
    );
    expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('should register the middleware on a Nest application', () => {
    const use = jest.fn();
    const fakeApp = { use } as any;

    configureSecurityHeaders(fakeApp);

    expect(use).toHaveBeenCalledTimes(1);
    expect(typeof use.mock.calls[0][0]).toBe('function');
  });

  it('should return a middleware function', () => {
    expect(typeof securityHeaders()).toBe('function');
  });
});
