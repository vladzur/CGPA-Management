import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ProveedorPago } from '@cgpa/shared';
import { PASARELAS_PAGO, type PasarelaPago } from './pasarela-pago.interface';

/**
 * Resuelve la pasarela que corresponde a un método de pago solicitado.
 *
 * Es el único punto del backend que conoce la lista de implementaciones; el
 * orquestador trabaja siempre contra la interfaz `PasarelaPago`.
 */
@Injectable()
export class PasarelasService {
  private readonly registro: Map<ProveedorPago, PasarelaPago>;

  constructor(@Inject(PASARELAS_PAGO) pasarelas: PasarelaPago[]) {
    this.registro = new Map(
      pasarelas.map((pasarela) => [pasarela.id, pasarela]),
    );
  }

  obtener(id: string): PasarelaPago {
    const pasarela = this.registro.get(id as ProveedorPago);

    if (!pasarela) {
      throw new BadRequestException(`Método de pago no soportado: ${id}`);
    }

    return pasarela;
  }
}
