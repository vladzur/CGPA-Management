import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { CreatePagoDto, CreatePagoSchema } from './dto/create-pago.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Access } from '../common/access/access.decorator';

@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  /**
   * Crea un cobro con el método de pago indicado y devuelve la URL del portal.
   * Es público porque el botón de pago está en el sitio institucional.
   */
  @Post(':proveedor')
  @Access('PUBLIC')
  @HttpCode(HttpStatus.CREATED)
  crearPago(
    @Param('proveedor') proveedor: string,
    @Body(new ZodValidationPipe(CreatePagoSchema)) dto: CreatePagoDto,
  ) {
    return this.pagosService.crearPago(proveedor, dto);
  }

  /**
   * Notificación de la pasarela. El cuerpo puede llegar como JSON o como
   * `application/x-www-form-urlencoded`; cada pasarela extrae su propia
   * referencia y el pago se verifica servidor a servidor.
   */
  @Post(':proveedor/webhook')
  @Access('PUBLIC')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Param('proveedor') proveedor: string,
    @Body() body: Record<string, unknown>,
  ) {
    const resultado = await this.pagosService.procesarNotificacion(
      proveedor,
      body ?? {},
    );

    return { recibido: true, estado: resultado.estado };
  }

  /**
   * Errores reales de las pasarelas, para diagnóstico interno.
   *
   * Debe declararse antes de `GET /:transactionId` para que `errores` no se
   * interprete como un identificador de cobro.
   */
  @Get('errores')
  @Access('ADMIN')
  listarErroresPago() {
    return this.pagosService.listarErroresPago();
  }

  /** Consulta pública del estado, usada por la página de confirmación. */
  @Get(':transactionId')
  @Access('PUBLIC')
  consultarPago(@Param('transactionId') transactionId: string) {
    return this.pagosService.consultarPago(transactionId);
  }

  /** Historial de cobros para la directiva. */
  @Get()
  @Access('ADMIN')
  listarPagos() {
    return this.pagosService.listarPagos();
  }
}
