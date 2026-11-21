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

@Module({
  controllers: [
    AppController,
    TransactionsController,
    ProyectosController,
    UsuariosController,
    ComunicadosController,
    MensajesController,
    PagosController,
  ],
  providers: [
    AppService,
    FinanzasService,
    ProyectosService,
    UsuariosService,
    ComunicadosService,
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
  ],
})
export class TestAppModule {}
