import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto, CreateProyectoSchema } from './dto/create-proyecto.dto';
import { UpdateProyectoDto, UpdateProyectoSchema } from './dto/update-proyecto.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  create(@Body(new ZodValidationPipe(CreateProyectoSchema)) createProyectoDto: CreateProyectoDto) {
    return this.proyectosService.create(createProyectoDto);
  }

  @Get()
  findAll() {
    return this.proyectosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.proyectosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string, 
    @Body(new ZodValidationPipe(UpdateProyectoSchema)) updateProyectoDto: UpdateProyectoDto
  ) {
    return this.proyectosService.update(id, updateProyectoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.proyectosService.remove(id);
  }
}
