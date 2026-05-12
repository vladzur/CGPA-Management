import { z } from 'zod';

export class UpdateDocumentoDto {
  titulo?: string;
  descripcion?: string;
  rut_emisor?: string;
}

export const UpdateDocumentoSchema = z.object({
  titulo: z.string().min(1).optional(),
  descripcion: z.string().min(1).optional(),
  rut_emisor: z.string().min(1).optional(),
});
