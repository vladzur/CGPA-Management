import { DocumentoSchema, Documento } from '@cgpa/shared';

export class CreateDocumentoDto implements Omit<
  Documento,
  | 'fecha_creacion'
  | 'creado_por'
  | 'fecha_actualizacion'
  | 'hash_integridad'
  | 'uuid_verificacion'
  | 'qr_base64'
  | 'salt'
  | 'fecha_sellado'
> {
  titulo: string;
  descripcion: string;
  monto: number;
  fecha_emision: Date;
  rut_emisor: string;
  estado: Documento['estado'];
}

export const CreateDocumentoSchema = DocumentoSchema.omit({
  fecha_creacion: true,
  creado_por: true,
  fecha_actualizacion: true,
  hash_integridad: true,
  uuid_verificacion: true,
  qr_base64: true,
  salt: true,
  fecha_sellado: true,
});
