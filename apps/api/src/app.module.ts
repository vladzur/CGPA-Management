import { Module } from '@nestjs/common';
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

@Module({
  imports: [ProyectosModule, AuditModule, CryptoSealModule, UsuariosModule, ComunicadosModule],
  controllers: [AppController, TransactionsController],
  providers: [AppService, FinanzasService, StorageService],
})
export class AppModule {}

