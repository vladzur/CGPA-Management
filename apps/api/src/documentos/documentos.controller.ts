import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  UseGuards,
  Req,
  Header,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto, CreateDocumentoSchema } from './dto/create-documento.dto';
import { UpdateDocumentoDto, UpdateDocumentoSchema } from './dto/update-documento.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly service: DocumentosService) {}

  /**
   * Endpoint público de verificación — no requiere autenticación.
   * Debe declararse antes de GET :id para evitar colisión de rutas.
   */
  @Get('validar/:uuid')
  findByVerificationUuid(@Param('uuid') uuid: string) {
    return this.service.findByVerificationUuid(uuid);
  }

  @Get()
  @UseGuards(FirebaseAuthGuard)
  findAll(@Query('estado') estado?: string) {
    return this.service.findAll(estado);
  }

  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  create(
    @Body(new ZodValidationPipe(CreateDocumentoSchema)) dto: CreateDocumentoDto,
    @Req() req: any,
  ) {
    return this.service.create(dto, req.user.uid, req.user.name);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateDocumentoSchema)) dto: UpdateDocumentoDto,
    @Req() req: any,
  ) {
    return this.service.update(id, dto, req.user.uid, req.user.name);
  }

  @Post(':id/sellar')
  @UseGuards(FirebaseAuthGuard)
  sellar(@Param('id') id: string, @Req() req: any) {
    return this.service.sellar(id, req.user.uid, req.user.name);
  }

  @Get(':id/pdf')
  @UseGuards(FirebaseAuthGuard)
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="documento.pdf"')
  async generatePdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.service.generatePdf(id);
    return new StreamableFile(buffer);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user.uid, req.user.name);
  }
}
