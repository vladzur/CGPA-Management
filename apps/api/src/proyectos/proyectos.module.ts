import { Module } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { ProyectosController } from './proyectos.controller';

@Module({
  controllers: [ProyectosController],
  providers: [ProyectosService],
})
export class ProyectosModule {}
