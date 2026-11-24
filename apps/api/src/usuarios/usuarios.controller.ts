import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Get,
  Delete,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { Access } from '../common/access/access.decorator';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post('registro')
  @Access('AUTHENTICATED')
  register(@Req() req: any) {
    return this.usuariosService.registerUser(
      req.user.uid,
      req.user.email,
      req.user.name,
    );
  }

  @Get()
  @Access('ADMIN')
  getAll() {
    return this.usuariosService.getAllUsers();
  }

  @Get('pendientes')
  @Access('ADMIN')
  getPending() {
    return this.usuariosService.getPendingUsers();
  }

  @Patch(':uid/aprobar')
  @Access('ADMIN')
  approve(
    @Param('uid') targetUid: string,
    @Body('rol') role: string,
    @Req() req: any,
  ) {
    if (!role) {
      throw new ForbiddenException(
        'Debe especificar un rol para aprobar al usuario',
      );
    }
    return this.usuariosService.approveUser(
      targetUid,
      role,
      req.user.uid,
      req.user.name,
    );
  }

  @Patch(':uid/rol')
  @Access('ADMIN')
  updateRole(
    @Param('uid') targetUid: string,
    @Body('rol') role: string,
    @Req() req: any,
  ) {
    if (!role) {
      throw new ForbiddenException('Debe especificar un rol');
    }
    return this.usuariosService.updateUserRole(
      targetUid,
      role,
      req.user.uid,
      req.user.name,
    );
  }

  @Patch(':uid/activar')
  @Access('ADMIN')
  toggleActive(@Param('uid') targetUid: string, @Req() req: any) {
    return this.usuariosService.deactivateUser(
      targetUid,
      req.user.uid,
      req.user.name,
    );
  }

  @Delete(':uid')
  @Access('ADMIN')
  delete(@Param('uid') targetUid: string, @Req() req: any) {
    return this.usuariosService.deleteUser(
      targetUid,
      req.user.uid,
      req.user.name,
    );
  }
}
