import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { OtpService } from 'src/modules/auth/services/otp.service';
import { OTP_REQUIRED_KEY } from 'src/modules/shared/decorators/otp-required.decorator';
import { JwtUser } from 'src/modules/shared/interfaces/jwt-user.interface';

interface AuthenticatedRequest extends Request {
  user?: JwtUser;
  body: { otpCode?: string };
}

@Injectable()
export class OtpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly otpService: OtpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isOtpRequired = this.reflector.getAllAndOverride<boolean>(
      OTP_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isOtpRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.email) {
      throw new UnauthorizedException(
        'Authentication required for OTP validation',
      );
    }

    const otpCode =
      (request.headers['x-otp-code'] as string | undefined) ||
      request.body?.otpCode;
    if (!otpCode) {
      throw new BadRequestException(
        'OTP code is required in x-otp-code header or request body',
      );
    }

    await this.otpService.verifyOtp(user.email, otpCode);
    return true;
  }
}
