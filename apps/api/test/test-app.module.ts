/**
 * @file test-app.module.ts
 * @description Módulo NestJS de prueba para tests E2E que reemplaza todas las
 * dependencias externas (Firebase Admin) con mocks. Esto permite testear los
 * controllers HTTP sin conectarse a Firebase real.
 */
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { TransactionsController } from '../src/transactions/transactions.controller';
import { ProyectosController } from '../src/proyectos/proyectos.controller';
import { UsuariosController } from '../src/usuarios/usuarios.controller';
import { FinanzasService } from '../src/finanzas/finanzas.service';
import { ProyectosService } from '../src/proyectos/proyectos.service';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { StorageService } from '../src/storage/storage.service';
import { AuditService } from '../src/common/audit/audit.service';
import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';

@Module({
  controllers: [AppController, TransactionsController, ProyectosController, UsuariosController],
  providers: [
    AppService,
    FinanzasService,
    ProyectosService,
    UsuariosService,
    StorageService,
    AuditService,
    // El guard se registra globalmente en el módulo de test
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
  ],
})
export class TestAppModule {}
