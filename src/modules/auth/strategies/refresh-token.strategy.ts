import { Injectable, UnauthorizedException } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { PassportStrategy } from '@nestjs/passport';

import { Strategy } from 'passport-jwt';

import { Request } from 'express';

import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { ROLE } from '@prisma/client';

import { REFRESH_TOKEN_COOKIE } from '../constants/auth-cookies.constants';

import { jwtFromCookieOrBearer } from '../utils/jwt-extractors';

import { AuthSessionService } from '../services/auth-session.service';

type RefreshPayload = {
  sub: string;
  email: string;
  role?: ROLE;
  refreshId?: string;
};

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authSessionService: AuthSessionService,
  ) {
    super({
      jwtFromRequest: jwtFromCookieOrBearer(REFRESH_TOKEN_COOKIE),

      ignoreExpiration: false,

      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),

      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: RefreshPayload) {
    const refreshToken = jwtFromCookieOrBearer(REFRESH_TOKEN_COOKIE)(req);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    const account =
      payload.role === ROLE.ADMIN
        ? await this.prisma.admin.findUnique({
            where: { id: payload.sub },
            select: {
              id: true,
              email: true,
              role: true,
              refreshToken: true,
              refreshTokenId: true,
              isActive: true,
            },
          })
        : await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
              id: true,
              email: true,
              role: true,
              refreshToken: true,
              refreshTokenId: true,
              isActive: true,
            },
          });

    return this.authSessionService.validateRefreshToken(
      account,
      refreshToken,
      payload,
    );
  }
}
