import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UsePipes,
  Header,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LibroBalanceService } from './libro-balance.service';
import {
  GenerateBalanceBookDto,
  GenerateBalanceBookSchema,
} from './dto/generate-balance-book.dto';

@Controller('libro-balance')
export class LibroBalanceController {
  constructor(private readonly libroBalanceService: LibroBalanceService) {}

  @Post('generar')
  @UseGuards(FirebaseAuthGuard)
  @Header('Content-Type', 'application/pdf')
  async generar(
    @Body(new ZodValidationPipe(GenerateBalanceBookSchema))
    dto: GenerateBalanceBookDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.libroBalanceService.generateBalanceBook(
      dto,
      req.user.uid,
      req.user.name,
    );

    res.set({
      'Content-Disposition': `attachment; filename="libro-balance-${dto.periodo}.pdf"`,
      'Content-Type': 'application/pdf',
    });

    return new StreamableFile(buffer);
  }
}
