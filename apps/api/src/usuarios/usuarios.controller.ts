import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Get,
  Delete,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';

function requireAdmin(req: any) {
  if (req.user.role !== 'ADMIN') {
    throw new ForbiddenException(
      'Solo los administradores pueden realizar esta accion',
    );
  }
}

@Controller('usuarios')
@UseGuards(FirebaseAuthGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post('registro')
  register(@Req() req: any) {
    return this.usuariosService.registerUser(
      req.user.uid,
      req.user.email,
      req.user.name,
    );
  }

  @Get()
  getAll(@Req() req: any) {
    requireAdmin(req);
    return this.usuariosService.getAllUsers();
  }

  @Get('pendientes')
  getPending(@Req() req: any) {
    requireAdmin(req);
    return this.usuariosService.getPendingUsers();
  }

  @Patch(':uid/aprobar')
  approve(
    @Param('uid') targetUid: string,
    @Body('rol') role: string,
    @Req() req: any,
  ) {
    requireAdmin(req);
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
  updateRole(
    @Param('uid') targetUid: string,
    @Body('rol') role: string,
    @Req() req: any,
  ) {
    requireAdmin(req);
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
  toggleActive(@Param('uid') targetUid: string, @Req() req: any) {
    requireAdmin(req);
    return this.usuariosService.deactivateUser(
      targetUid,
      req.user.uid,
      req.user.name,
    );
  }

  @Delete(':uid')
  delete(@Param('uid') targetUid: string, @Req() req: any) {
    requireAdmin(req);
    return this.usuariosService.deleteUser(
      targetUid,
      req.user.uid,
      req.user.name,
    );
  }
}
