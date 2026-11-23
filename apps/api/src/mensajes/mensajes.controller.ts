import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { MensajeEstado } from '@cgpa/shared';
import { MensajesService } from './mensajes.service';
import {
  CreateMensajeDto,
  CreateMensajeSchema,
} from './dto/create-mensaje.dto';
import {
  UpdateMensajeDto,
  UpdateMensajeSchema,
} from './dto/update-mensaje.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Access } from '../common/access/access.decorator';

@Controller('mensajes')
export class MensajesController {
  constructor(private readonly mensajesService: MensajesService) {}

  /**
   * Endpoint público del formulario de contacto del sitio institucional.
   * No requiere autenticación porque lo usan los apoderados.
   */
  @Post()
  @Access('PUBLIC')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(CreateMensajeSchema))
    createMensajeDto: CreateMensajeDto,
    @Req() req: any,
  ) {
    // Campo trampa: un envío automatizado recibe la misma respuesta que uno
    // legítimo, pero no se almacena ni llega a la bandeja de la directiva.
    if (createMensajeDto.sitio_web) {
      return { id: null, recibido: true };
    }

    return this.mensajesService.create(createMensajeDto, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }

  /** Bandeja de la directiva: solo accesible para administradores activos. */
  @Get()
  @Access('ADMIN')
  findAll(@Query('estado') estado?: MensajeEstado) {
    return this.mensajesService.findAll(estado);
  }

  @Patch(':id')
  @Access('ADMIN')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateMensajeSchema))
    updateMensajeDto: UpdateMensajeDto,
    @Req() req: any,
  ) {
    return this.mensajesService.updateStatus(
      id,
      updateMensajeDto,
      req.user.uid,
      req.user.name,
    );
  }

  @Delete(':id')
  @Access('ADMIN')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.mensajesService.remove(id, req.user.uid, req.user.name);
  }
}
