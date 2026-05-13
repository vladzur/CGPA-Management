/**
 * @file test-app.module.ts
 * @description Módulo NestJS de prueba para tests E2E que reemplaza todas las
 * dependencias externas (Firebase Admin) con mocks. Esto permite testear los
 * controllers HTTP sin conectarse a Firebase real.
 */
import { Module } from '@nestjs/common';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { TransactionsController } from '../src/transactions/transactions.controller';
import { ProyectosController } from '../src/proyectos/proyectos.controller';
import { UsuariosController } from '../src/usuarios/usuarios.controller';
import { FinanzasService } from '../src/finanzas/finanzas.service';
import { ProyectosService } from '../src/proyectos/proyectos.service';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { ComunicadosController } from '../src/comunicados/comunicados.controller';
import { ComunicadosService } from '../src/comunicados/comunicados.service';
import { StorageService } from '../src/storage/storage.service';
import { AuditService } from '../src/common/audit/audit.service';

@Module({
  controllers: [
    AppController,
    TransactionsController,
    ProyectosController,
    UsuariosController,
    ComunicadosController,
  ],
  providers: [
    AppService,
    FinanzasService,
    ProyectosService,
    UsuariosService,
    ComunicadosService,
    StorageService,
    AuditService,
  ],
})
export class TestAppModule {}
