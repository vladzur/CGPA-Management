import { Module } from '@nestjs/common';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { PasarelasService } from './pasarelas/pasarelas.service';
import { KhipuPasarela } from './pasarelas/khipu/khipu-pasarela';
import {
  PASARELAS_PAGO,
  type PasarelaPago,
} from './pasarelas/pasarela-pago.interface';

@Module({
  controllers: [PagosController],
  providers: [
    PagosService,
    PasarelasService,
    KhipuPasarela,
    {
      provide: PASARELAS_PAGO,
      inject: [KhipuPasarela],
      useFactory: (...pasarelas: PasarelaPago[]) => pasarelas,
    },
  ],
  exports: [PagosService],
})
export class PagosModule {}
