import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query,
  UseGuards, Req, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ComunicadosService } from './comunicados.service';
import { StorageService } from '../storage/storage.service';
import { CreateComunicadoDto, CreateComunicadoSchema } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto, UpdateComunicadoSchema } from './dto/update-comunicado.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';

@Controller('comunicados')
export class ComunicadosController {
  constructor(
    private readonly comunicadosService: ComunicadosService,
    private readonly storageService: StorageService,
  ) {}

  @Get('publicos')
  findAllPublic() {
    return this.comunicadosService.findAllPublic();
  }

  @Get()
  @UseGuards(FirebaseAuthGuard)
  findAll(@Query('estado') estado?: string) {
    return this.comunicadosService.findAll(estado);
  }

  @Get(':id')
  @UseGuards(FirebaseAuthGuard)
  findOne(@Param('id') id: string) {
    return this.comunicadosService.findOne(id);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  create(
    @Body(new ZodValidationPipe(CreateComunicadoSchema)) createComunicadoDto: CreateComunicadoDto,
    @Req() req: any,
  ) {
    return this.comunicadosService.create(createComunicadoDto, req.user.uid, req.user.name);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateComunicadoSchema)) updateComunicadoDto: UpdateComunicadoDto,
    @Req() req: any,
  ) {
    return this.comunicadosService.update(id, updateComunicadoDto, req.user.uid, req.user.name);
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.comunicadosService.remove(id, req.user.uid, req.user.name);
  }

  @Post('imagenes')
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No se proporciono ninguna imagen');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('El archivo debe ser una imagen');
    }
    const url = await this.storageService.uploadComunicadoImage(file);
    return { url };
  }
}
