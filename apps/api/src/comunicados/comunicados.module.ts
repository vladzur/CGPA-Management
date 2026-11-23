import { Module } from '@nestjs/common';
import { ComunicadosService } from './comunicados.service';
import { ComunicadosController } from './comunicados.controller';
import { StorageService } from '../storage/storage.service';
import { MarkdownPolicyService } from '../common/markdown/markdown-policy.service';

@Module({
  controllers: [ComunicadosController],
  providers: [ComunicadosService, StorageService, MarkdownPolicyService],
})
export class ComunicadosModule {}
