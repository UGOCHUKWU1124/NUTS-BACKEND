import { Module } from '@nestjs/common';
import { OtpService } from './services/otp.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from 'src/modules/auth/strategies/jwt.strategy';
import { RefreshTokenStrategy } from 'src/modules/auth/strategies/refresh-token.strategy';
import { AuthCookiesModule } from './auth-cookies.module';
import { UsersModule } from 'src/modules/users/users.module';
import { DiscountCodeModule } from 'src/modules/promotions/discount-code.module';
import { ReferralModule } from 'src/modules/referral/referral.module';
import { AuthSessionService } from './services/auth-session.service';
import { SecurityModule } from 'src/modules/security/security.module';

@Module({
  imports: [
    AuthCookiesModule,
    UsersModule,
    DiscountCodeModule,
    ReferralModule,
    SecurityModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    AuthService,
    OtpService,
    JwtStrategy,
    RefreshTokenStrategy,
    AuthSessionService,
  ],
  controllers: [AuthController],
  exports: [AuthService, AuthCookiesModule, OtpService],
})
export class AuthModule {}
