import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, CookieOptions } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  AUTH_COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
} from './constants/auth-cookies.constants';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshId: string;
}

@Injectable()
export class AuthCookieService {
  constructor(private readonly config: ConfigService) {}

  setAuthCookies(res: Response, tokens: AuthTokens): void {
    const base = this.getCookieBaseOptions();

    const accessMaxAge = this.msFromExpires(
      this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
    );

    const refreshMaxAge = this.msFromExpires(
      this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...base,
      maxAge: accessMaxAge,
      path: '/',
    });

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...base,
      maxAge: refreshMaxAge,
      path: AUTH_COOKIE_PATH,
    });
  }

  clearAuthCookies(res: Response): void {
    const base = this.getCookieBaseOptions();

    res.clearCookie(ACCESS_TOKEN_COOKIE, {
      ...base,
      path: '/',
    });

    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...base,
      path: AUTH_COOKIE_PATH,
    });
  }

  private getCookieBaseOptions(): CookieOptions {
    const isProd = this.config.get('NODE_ENV') === 'production';
    const domain = this.config.get<string>('COOKIE_DOMAIN');

    const options: CookieOptions = {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    };

    if (domain) {
      options.domain = domain;
    }

    return options;
  }

  private msFromExpires(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());

    if (!match) {
      throw new Error(`Invalid expiration format: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2];

    const multipliers: Record<'s' | 'm' | 'h' | 'd', number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return amount * multipliers[unit as 's' | 'm' | 'h' | 'd'];
  }
}
