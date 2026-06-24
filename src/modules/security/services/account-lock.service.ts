import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { SECURITY } from 'src/modules/shared/constants';

@Injectable()
export class AccountLockService {
  private readonly logger = new Logger(AccountLockService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Record a failed login attempt for the given identifier.
   * Returns the current attempt count.
   */
  async recordFailedAttempt(identifier: string): Promise<number> {
    const key = `login:attempts:${identifier}`;
    const attempts = await this.redis.incr(key);

    // Set TTL on first attempt
    if (attempts === 1) {
      await this.redis.expire(key, SECURITY.LOCKOUT_DURATION_MINUTES * 60);
    }

    if (attempts >= SECURITY.MAX_LOGIN_ATTEMPTS) {
      await this.lockAccount(identifier);
    }

    return attempts;
  }

  /**
   * Check if an account is locked.
   */
  async isLocked(identifier: string): Promise<boolean> {
    const lockKey = `login:locked:${identifier}`;
    const locked = await this.redis.get(lockKey);
    return locked !== null;
  }

  /**
   * Get remaining lockout time in seconds.
   */
  async getLockoutTimeRemaining(identifier: string): Promise<number> {
    const lockKey = `login:locked:${identifier}`;
    const ttl = await this.redis.ttl(lockKey);
    return Math.max(0, ttl);
  }

  /**
   * Reset failed attempt counter on successful login.
   */
  async resetAttempts(identifier: string): Promise<void> {
    const key = `login:attempts:${identifier}`;
    await this.redis.del(key);
  }

  /**
   * Lock an account for the configured duration.
   */
  private async lockAccount(identifier: string): Promise<void> {
    const lockKey = `login:locked:${identifier}`;
    await this.redis.setex(
      lockKey,
      SECURITY.LOCKOUT_DURATION_MINUTES * 60,
      '1',
    );
    this.logger.warn(
      { identifier },
      'Account locked due to too many failed attempts',
    );
  }
}
