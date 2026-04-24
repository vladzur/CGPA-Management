import { Controller, Post, Body, Patch, Param, Get, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';

@Controller('usuarios')
@UseGuards(FirebaseAuthGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post('registro')
  register(@Req() req: any) {
    // El usuario se acaba de registrar en Firebase Auth (Frontend),
    // tomamos sus datos del token JWT validado por el guard.
    return this.usuariosService.registerUser(req.user.uid, req.user.email, req.user.name);
  }

  @Get('pendientes')
  getPending(@Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo los administradores pueden ver los usuarios pendientes');
    }
    return this.usuariosService.getPendingUsers();
  }

  @Patch(':uid/aprobar')
  approve(
    @Param('uid') targetUid: string, 
    @Body('rol') role: string, 
    @Req() req: any
  ) {
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Solo los administradores pueden aprobar usuarios');
    }
    if (!role) {
      throw new ForbiddenException('Debe especificar un rol para aprobar al usuario');
    }

    return this.usuariosService.approveUser(targetUid, role, req.user.uid, req.user.name);
  }
}
