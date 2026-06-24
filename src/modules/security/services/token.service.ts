import { Injectable, Inject, Logger } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Invalidate a refresh token by adding it to a blacklist.
   */
  async invalidateRefreshToken(
    tokenId: string,
    expiresInMs: number,
  ): Promise<void> {
    const key = `refresh:blacklist:${tokenId}`;
    await this.redis.setex(key, Math.ceil(expiresInMs / 1000), '1');
  }

  /**
   * Check if a refresh token has been invalidated.
   */
  async isRefreshTokenInvalidated(tokenId: string): Promise<boolean> {
    const key = `refresh:blacklist:${tokenId}`;
    const result = await this.redis.get(key);
    return result !== null;
  }

  /**
   * Rotate a refresh token: invalidate the old one and issue a new one.
   */
  async rotateRefreshToken(
    oldTokenId: string,
    oldTokenExpiresInMs: number,
    payload: Record<string, unknown>,
  ): Promise<{ newToken: string; newTokenId: string }> {
    // Invalidate old token
    await this.invalidateRefreshToken(oldTokenId, oldTokenExpiresInMs);

    // Generate new token with new jti
    const newTokenId = this.generateTokenId();
    const expiresIn = (this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
    ) || '7d') as JwtSignOptions['expiresIn'];
    const newToken = this.jwtService.sign(
      { ...payload, jti: newTokenId },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn,
      },
    );

    return { newToken, newTokenId };
  }

  private generateTokenId(): string {
    return crypto.randomUUID();
  }
}
