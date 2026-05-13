import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FinanzasService } from '../finanzas/finanzas.service';
import { StorageService } from '../storage/storage.service';
import { CryptoSealService } from '../common/crypto/crypto-seal.service';
import {
  CreateTransactionDto,
  CreateTransactionSchema,
} from './dto/create-transaction.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly finanzasService: FinanzasService,
    private readonly storageService: StorageService,
    private readonly cryptoSealService: CryptoSealService,
  ) {}

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async createTransaction(
    @Body(new ZodValidationPipe(CreateTransactionSchema))
    createTransactionDto: CreateTransactionDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const userUid = req.user.uid;
    const userName = req.user.name;

    // 1. Si hay un comprobante, lo subimos a Storage primero
    if (file) {
      // Pequeña validación de mimetype por seguridad
      if (
        !file.mimetype.startsWith('image/') &&
        file.mimetype !== 'application/pdf'
      ) {
        throw new BadRequestException('El archivo debe ser una imagen o PDF');
      }
      const url = await this.storageService.uploadReceipt(file);
      createTransactionDto.respaldo_url = url;
    }

    // 2. Ejecutamos la transacción en Firestore usando el FinanzasService
    const resultado = await this.finanzasService.createTransaction(
      createTransactionDto,
      userUid,
      userName,
    );

    return {
      message: 'Transacción registrada y saldos actualizados con éxito',
      data: resultado,
    };
  }

  /**
   * Verificación pública de integridad criptográfica de la cadena de transacciones.
   *
   * Este endpoint es de ACCESO LIBRE para garantizar transparencia:
   * cualquier miembro puede verificar que el historial financiero
   * no ha sido alterado desde que fue registrado.
   *
   * @param limit - Opcional: limita el número de transacciones a verificar (útil para pruebas)
   */
  @Get('verify-integrity')
  async verifyIntegrity(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : undefined;
    const reporte = await this.cryptoSealService.verifyChainIntegrity(limitNum);

    return {
      message: reporte.mensaje,
      data: reporte,
    };
  }
}
