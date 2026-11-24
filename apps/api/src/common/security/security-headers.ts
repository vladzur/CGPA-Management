import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/**
 * Cabeceras de endurecimiento de la API.
 *
 * La API solo devuelve JSON, PDFs y descargas; su CSP es restrictiva y no
 * permite ejecutar scripts. La CSP del sitio se publica aparte en Firebase
 * Hosting.
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
        imgSrc: ["'none'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

/** Aplica las cabeceras de endurecimiento a una aplicación Nest. */
export function configureSecurityHeaders(app: INestApplication): void {
  app.use(securityHeaders());
}
