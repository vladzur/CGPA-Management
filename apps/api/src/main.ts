import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as admin from 'firebase-admin';

async function bootstrap() {
  // Forzar a Firebase Admin a usar los emuladores locales en vez de ir a Producción
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'demo-cgpa-platform',
    });
  }
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Opcional, por si el frontend y backend están en distintos puertos
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
