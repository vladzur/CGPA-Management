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
import { ComunicadosController } from '../src/comunicados/comunicados.controller';
import { ComunicadosService } from '../src/comunicados/comunicados.service';
import { MarkdownPolicyService } from '../src/common/markdown/markdown-policy.service';
import { MensajesController } from '../src/mensajes/mensajes.controller';
import { MensajesService } from '../src/mensajes/mensajes.service';
import { PagosController } from '../src/pagos/pagos.controller';
import { PagosService } from '../src/pagos/pagos.service';
import { PasarelasService } from '../src/pagos/pasarelas/pasarelas.service';
import { KhipuPasarela } from '../src/pagos/pasarelas/khipu/khipu-pasarela';
import {
  PASARELAS_PAGO,
  type PasarelaPago,
} from '../src/pagos/pasarelas/pasarela-pago.interface';
import { StorageService } from '../src/storage/storage.service';
import { AuditService } from '../src/common/audit/audit.service';
import { CryptoSealService } from '../src/common/crypto/crypto-seal.service';
import { DocumentosController } from '../src/documentos/documentos.controller';
import { DocumentosService } from '../src/documentos/documentos.service';
import { DocumentoIntegrityService } from '../src/documentos/documento-integrity.service';
import { LibroBalanceController } from '../src/libro-balance/libro-balance.controller';
import { LibroBalanceService } from '../src/libro-balance/libro-balance.service';
import { FirebaseAuthGuard } from '../src/common/guards/firebase-auth.guard';
import { AccessPolicyGuard } from '../src/common/access/access-policy.guard';

@Module({
  controllers: [
    AppController,
    TransactionsController,
    ProyectosController,
    UsuariosController,
    ComunicadosController,
    MensajesController,
    PagosController,
    DocumentosController,
    LibroBalanceController,
  ],
  providers: [
    AppService,
    FinanzasService,
    ProyectosService,
    UsuariosService,
    ComunicadosService,
    MarkdownPolicyService,
    MensajesService,
    PagosService,
    PasarelasService,
    KhipuPasarela,
    {
      provide: PASARELAS_PAGO,
      inject: [KhipuPasarela],
      useFactory: (...pasarelas: PasarelaPago[]) => pasarelas,
    },
    StorageService,
    AuditService,
    CryptoSealService,
    DocumentoIntegrityService,
    DocumentosService,
    LibroBalanceService,
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: AccessPolicyGuard },
  ],
})
export class TestAppModule {}
