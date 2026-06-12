import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private get bucket() {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      throw new InternalServerErrorException(
        'FIREBASE_STORAGE_BUCKET no está configurado en el servidor',
      );
    }
    return admin.storage().bucket(bucketName);
  }

  private async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    const extension = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${extension}`;
    const fileRef = this.bucket.file(fileName);

    await fileRef.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      return `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${this.bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
    }

    await fileRef.makePublic();
    return `https://storage.googleapis.com/${this.bucket.name}/${fileName}`;
  }

  /**
   * Sube un archivo al Storage de Firebase y devuelve su URL.
   */
  async uploadReceipt(file: Express.Multer.File): Promise<string> {
    try {
      return await this.uploadFile(file, 'comprobantes');
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error al subir el comprobante a Cloud Storage: ' + error.message,
      );
    }
  }

  /**
   * Sube una imagen de comunicado al Storage de Firebase y devuelve su URL.
   */
  async uploadComunicadoImage(file: Express.Multer.File): Promise<string> {
    try {
      return await this.uploadFile(file, 'comunicados');
    } catch (error: any) {
      throw new InternalServerErrorException(
        'Error al subir la imagen del comunicado a Cloud Storage: ' +
          error.message,
      );
    }
  }
}
