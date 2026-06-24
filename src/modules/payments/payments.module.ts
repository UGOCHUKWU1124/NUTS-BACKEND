import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { WalletModule } from 'src/modules/wallet/wallet.module';
import { ReferralModule } from 'src/modules/referral/referral.module';
import { MailModule } from 'src/modules/infrastructure/mail/mail.module';

@Module({
  imports: [UsersModule, AuthModule, WalletModule, ReferralModule, MailModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
