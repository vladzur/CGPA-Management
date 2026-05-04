import { Module } from '@nestjs/common';
import { ComunicadosService } from './comunicados.service';
import { ComunicadosController } from './comunicados.controller';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [ComunicadosController],
  providers: [ComunicadosService, StorageService],
})
export class ComunicadosModule {}
