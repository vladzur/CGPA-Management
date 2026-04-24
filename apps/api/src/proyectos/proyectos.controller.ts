import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto, CreateProyectoSchema } from './dto/create-proyecto.dto';
import { UpdateProyectoDto, UpdateProyectoSchema } from './dto/update-proyecto.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';

@Controller('proyectos')
@UseGuards(FirebaseAuthGuard)
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateProyectoSchema)) createProyectoDto: CreateProyectoDto,
    @Req() req: any
  ) {
    return this.proyectosService.create(createProyectoDto, req.user.uid, req.user.name);
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
    @Body(new ZodValidationPipe(UpdateProyectoSchema)) updateProyectoDto: UpdateProyectoDto,
    @Req() req: any
  ) {
    return this.proyectosService.update(id, updateProyectoDto, req.user.uid, req.user.name);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.proyectosService.remove(id, req.user.uid, req.user.name);
  }
}
