import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private get bucket() {
    return admin.storage().bucket('demo-cgpa-platform.appspot.com');
  }

  /**
   * Sube un archivo al Storage de Firebase y devuelve su URL.
   */
  async uploadReceipt(file: Express.Multer.File): Promise<string> {
    try {
      // Extraer extensión y generar nombre único
      const extension = file.originalname.split('.').pop();
      const fileName = `comprobantes/${uuidv4()}.${extension}`;
      const fileRef = this.bucket.file(fileName);

      // Guardar el archivo en el bucket
      await fileRef.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
        },
      });

      // Si estamos en entorno de desarrollo con el emulador, armamos la URL local
      if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
        return `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${this.bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;
      }
      
      // En producción, lo hacemos público o generamos un signed URL
      await fileRef.makePublic();
      return `https://storage.googleapis.com/${this.bucket.name}/${fileName}`;
      
    } catch (error: any) {
      throw new InternalServerErrorException('Error al subir el comprobante a Cloud Storage: ' + error.message);
    }
  }
}
