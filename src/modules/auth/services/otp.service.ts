import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { EmailService } from 'src/modules/infrastructure/mail/email.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly ttl: number;
  private readonly length: number;
  private readonly redisClient: Redis;

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') redisClient: Redis,
    private readonly emailService: EmailService,
  ) {
    this.redisClient = redisClient;
    this.ttl = Number(this.configService.get<number>('OTP_TTL_MIN', 10)) * 60;
    this.length = Number(this.configService.get<number>('OTP_LENGTH', 6));
  }

  private generateCode(): string {
    const max = Math.pow(10, this.length) - 1;
    const code = crypto
      .randomInt(0, max + 1)
      .toString()
      .padStart(this.length, '0');
    return code;
  }

  async createOtp(
    email: string,
    options?: { subject?: string; orderDetails?: string },
  ): Promise<string> {
    const otp = this.generateCode();
    const key = `otp:${email}`;
    await this.redisClient.set(key, otp, 'EX', this.ttl);
    await this.emailService.sendOtpEmail(email, otp, options);
    return otp;
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const key = `otp:${email}`;
    const attemptsKey = `otp_attempts:${email}`;

    const stored = await this.redisClient.get(key);
    if (!stored) {
      throw new BadRequestException('OTP expired or not found');
    }

    const attemptsStr = await this.redisClient.get(attemptsKey);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    if (attempts >= 5) {
      await this.redisClient.del(key);
      await this.redisClient.del(attemptsKey);
      throw new BadRequestException(
        'Too many invalid attempts. Please request a new OTP.',
      );
    }

    if (stored !== code) {
      await this.redisClient.incr(attemptsKey);
      if (attempts === 0) {
        await this.redisClient.expire(attemptsKey, this.ttl);
      }
      throw new BadRequestException('Invalid OTP');
    }

    // consume OTP
    await this.redisClient.del(key);
    await this.redisClient.del(attemptsKey);
    return true;
  }
}
