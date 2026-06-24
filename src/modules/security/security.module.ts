import { Module } from '@nestjs/common';
import { AccountLockService } from './services/account-lock.service';
import { TokenService } from './services/token.service';
import { PaystackWebhookGuard } from './guards/paystack-webhook.guard';
import { AccountLockGuard } from './guards/account-lock.guard';
import { ProgressiveDelayService } from './throttling/progressive-delay.throttler';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({})],
  providers: [
    AccountLockService,
    TokenService,
    PaystackWebhookGuard,
    AccountLockGuard,
    ProgressiveDelayService,
  ],
  exports: [
    AccountLockService,
    TokenService,
    PaystackWebhookGuard,
    AccountLockGuard,
    ProgressiveDelayService,
  ],
})
export class SecurityModule {}
