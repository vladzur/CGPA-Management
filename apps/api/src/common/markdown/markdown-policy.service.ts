import { BadRequestException, Injectable } from '@nestjs/common';
import {
  findMarkdownPolicyViolations,
  type MarkdownPolicyViolation,
} from './markdown-policy';

/**
 * Aplica la política de Markdown de los comunicados.
 *
 * El pipe de validación rechaza el contenido antes de llegar al servicio; esta
 * capa existe como defensa en profundidad para llamadas internas que no pasen
 * por el controlador.
 */
@Injectable()
export class MarkdownPolicyService {
  validate(contenido: string): MarkdownPolicyViolation[] {
    return findMarkdownPolicyViolations(contenido);
  }

  assertValid(contenido: string): void {
    const violations = this.validate(contenido);

    if (violations.length === 0) return;

    throw new BadRequestException({
      message:
        'El contenido del comunicado no cumple la política de Markdown: no se permite HTML crudo ni protocolos no seguros.',
      errors: violations.map((violation) => violation.message),
    });
  }
}
