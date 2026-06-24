import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { UserWalletController } from './user-wallet.controller';

@Module({
  controllers: [UserWalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
