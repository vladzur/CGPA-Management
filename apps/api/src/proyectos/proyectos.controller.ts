import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import {
  CreateProyectoDto,
  CreateProyectoSchema,
} from './dto/create-proyecto.dto';
import {
  UpdateProyectoDto,
  UpdateProyectoSchema,
} from './dto/update-proyecto.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Access } from '../common/access/access.decorator';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  @Access('ADMIN')
  create(
    @Body(new ZodValidationPipe(CreateProyectoSchema))
    createProyectoDto: CreateProyectoDto,
    @Req() req: any,
  ) {
    return this.proyectosService.create(
      createProyectoDto,
      req.user.uid,
      req.user.name,
    );
  }

  @Get()
  @Access('PUBLIC')
  findAll() {
    return this.proyectosService.findAll();
  }

  @Get(':id')
  @Access('PUBLIC')
  findOne(@Param('id') id: string) {
    return this.proyectosService.findOne(id);
  }

  @Patch(':id')
  @Access('ADMIN')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProyectoSchema))
    updateProyectoDto: UpdateProyectoDto,
    @Req() req: any,
  ) {
    return this.proyectosService.update(
      id,
      updateProyectoDto,
      req.user.uid,
      req.user.name,
    );
  }

  @Post(':id/finalizar')
  @Access('ADMIN')
  finalizar(@Param('id') id: string, @Req() req: any) {
    return this.proyectosService.finalizar(id, req.user.uid, req.user.name);
  }

  @Delete(':id')
  @Access('ADMIN')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.proyectosService.remove(id, req.user.uid, req.user.name);
  }
}
