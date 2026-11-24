import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  Header,
  StreamableFile,
} from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import {
  CreateDocumentoDto,
  CreateDocumentoSchema,
} from './dto/create-documento.dto';
import {
  UpdateDocumentoDto,
  UpdateDocumentoSchema,
} from './dto/update-documento.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Access } from '../common/access/access.decorator';

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly service: DocumentosService) {}

  /**
   * Endpoint público de verificación — no requiere autenticación.
   * Debe declararse antes de GET :id para evitar colisión de rutas.
   */
  @Get('validar/:uuid')
  @Access('PUBLIC')
  findByVerificationUuid(@Param('uuid') uuid: string) {
    return this.service.findByVerificationUuid(uuid);
  }

  @Get()
  @Access('ADMIN')
  findAll(@Query('estado') estado?: string) {
    return this.service.findAll(estado);
  }

  @Get(':id')
  @Access('ADMIN')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Access('ADMIN')
  create(
    @Body(new ZodValidationPipe(CreateDocumentoSchema)) dto: CreateDocumentoDto,
    @Req() req: any,
  ) {
    return this.service.create(dto, req.user.uid, req.user.name);
  }

  @Patch(':id')
  @Access('ADMIN')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDocumentoSchema)) dto: UpdateDocumentoDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user.uid, req.user.name);
  }

  @Post(':id/sellar')
  @Access('ADMIN')
  sellar(@Param('id') id: string, @Req() req: any) {
    return this.service.sellar(id, req.user.uid, req.user.name);
  }

  @Get(':id/pdf')
  @Access('ADMIN')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="documento.pdf"')
  async generatePdf(@Param('id') id: string) {
    const buffer = await this.service.generatePdf(id);
    return new StreamableFile(buffer);
  }

  @Delete(':id')
  @Access('ADMIN')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.uid, req.user.name);
  }
}
