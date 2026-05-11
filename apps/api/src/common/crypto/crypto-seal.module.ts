import { Module } from '@nestjs/common';
import { CryptoSealService } from './crypto-seal.service';

@Module({
  providers: [CryptoSealService],
  exports: [CryptoSealService],
})
export class CryptoSealModule {}
