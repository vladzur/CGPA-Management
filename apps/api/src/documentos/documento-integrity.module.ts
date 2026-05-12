import { Module } from '@nestjs/common';
import { DocumentoIntegrityService } from './documento-integrity.service';

@Module({
  providers: [DocumentoIntegrityService],
  exports: [DocumentoIntegrityService],
})
export class DocumentoIntegrityModule {}
