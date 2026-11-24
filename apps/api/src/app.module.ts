import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TransactionsController } from './transactions/transactions.controller';
import { FinanzasService } from './finanzas/finanzas.service';
import { StorageService } from './storage/storage.service';
import { ProyectosModule } from './proyectos/proyectos.module';
import { AuditModule } from './common/audit/audit.module';
import { CryptoSealModule } from './common/crypto/crypto-seal.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ComunicadosModule } from './comunicados/comunicados.module';
import { DocumentosModule } from './documentos/documentos.module';
import { LibroBalanceModule } from './libro-balance/libro-balance.module';
import { MensajesModule } from './mensajes/mensajes.module';
import { PagosModule } from './pagos/pagos.module';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { AccessPolicyGuard } from './common/access/access-policy.guard';

@Module({
  imports: [
    ProyectosModule,
    AuditModule,
    CryptoSealModule,
    UsuariosModule,
    ComunicadosModule,
    DocumentosModule,
    LibroBalanceModule,
    MensajesModule,
    PagosModule,
  ],
  controllers: [AppController, TransactionsController],
  providers: [
    AppService,
    FinanzasService,
    StorageService,
    // El orden importa: primero se valida el token y luego se aplica la política.
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: AccessPolicyGuard },
  ],
})
export class AppModule {}
