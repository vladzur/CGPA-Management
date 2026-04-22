import { Controller, Post, Body, UsePipes, Req, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FinanzasService } from '../finanzas/finanzas.service';
import { StorageService } from '../storage/storage.service';
import { CreateTransactionDto, CreateTransactionSchema } from './dto/create-transaction.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly finanzasService: FinanzasService,
    private readonly storageService: StorageService
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async createTransaction(
    @Body(new ZodValidationPipe(CreateTransactionSchema)) createTransactionDto: CreateTransactionDto, 
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any
  ) {
    // En un escenario real, userUid y userName vendrían del objeto req después 
    // de pasar por un middleware o Guard de Firebase Auth (ej: req.user.uid).
    const mockUserUid = 'usuario-123';
    const mockUserName = 'Juan Pérez (Tesorero)';

    // 1. Si hay un comprobante, lo subimos a Storage primero
    if (file) {
      // Pequeña validación de mimetype por seguridad
      if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
        throw new BadRequestException('El archivo debe ser una imagen o PDF');
      }
      const url = await this.storageService.uploadReceipt(file);
      createTransactionDto.respaldo_url = url;
    }

    // 2. Ejecutamos la transacción en Firestore usando el FinanzasService
    const resultado = await this.finanzasService.createTransaction(
      createTransactionDto,
      mockUserUid,
      mockUserName,
    );

    return {
      message: 'Transacción registrada y saldos actualizados con éxito',
      data: resultado,
    };
  }
}
