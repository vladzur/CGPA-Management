import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TransactionsController } from './transactions/transactions.controller';
import { FinanzasService } from './finanzas/finanzas.service';
import { StorageService } from './storage/storage.service';
import { ProyectosModule } from './proyectos/proyectos.module';
import { AuditModule } from './common/audit/audit.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [ProyectosModule, AuditModule, UsuariosModule],
  controllers: [AppController, TransactionsController],
  providers: [AppService, FinanzasService, StorageService],
})
export class AppModule {}
