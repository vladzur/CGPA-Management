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
  UseGuards,
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
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('mensajes')
export class MensajesController {
  constructor(private readonly mensajesService: MensajesService) {}

  /**
   * Endpoint público del formulario de contacto del sitio institucional.
   * No requiere autenticación porque lo usan los apoderados.
   */
  @Post()
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
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  findAll(@Query('estado') estado?: MensajeEstado) {
    return this.mensajesService.findAll(estado);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
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
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.mensajesService.remove(id, req.user.uid, req.user.name);
  }
}
