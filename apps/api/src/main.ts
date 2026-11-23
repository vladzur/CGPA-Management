import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureSecurityHeaders } from './common/security/security-headers';
import * as admin from 'firebase-admin';

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    // Forzar a Firebase Admin a usar los emuladores locales en vez de ir a Producción
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: 'cgpa-liceo-agb',
      });
    }
  } else {
    // En producción (Cloud Run), Firebase Admin se autoconfigura con las credenciales
    // del servicio en el que está ejecutándose.
    if (!admin.apps.length) {
      admin.initializeApp();
    }

    // Crear documento de configuracion global si no existe (first-run)
    const db = admin.firestore();
    const configRef = db.collection('configuracion').doc('liceo_agb');
    const configSnap = await configRef.get();
    if (!configSnap.exists) {
      await configRef.set({
        nombre: 'Centro General de Padres AGB',
        periodo_actual: '2026',
        saldo_total: 0,
        ultima_actualizacion: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Documento de configuracion global creado automaticamente.');
    }
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api'); // Agregado para que coincida con el rewrite de Firebase Hosting

  // Cabeceras de endurecimiento también para el origen directo de Cloud Run.
  configureSecurityHeaders(app);

  // Los reportes CSP llegan con content-types propios del navegador.
  app.useBodyParser('json', {
    type: [
      'application/json',
      'application/csp-report',
      'application/reports+json',
    ],
  });

  app.enableCors(); // Opcional, por si el frontend y backend están en distintos puertos
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
