import { Module } from '@nestjs/common';
import { LibroBalanceController } from './libro-balance.controller';
import { LibroBalanceService } from './libro-balance.service';
import { DocumentosModule } from '../documentos/documentos.module';

@Module({
  imports: [DocumentosModule],
  controllers: [LibroBalanceController],
  providers: [LibroBalanceService],
})
export class LibroBalanceModule {}
