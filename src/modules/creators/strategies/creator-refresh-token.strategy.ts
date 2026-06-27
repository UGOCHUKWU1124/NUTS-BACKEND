import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';

export type CreatorRefreshTokenPayload = {
  sub: string;
  email: string;
  refreshId: string;
  type: 'creator';
};

@Injectable()
export class CreatorRefreshTokenStrategy extends PassportStrategy(
  Strategy,
  'creator-refresh-token',
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('JWT_REFRESH_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(
    req: { headers?: Record<string, string | string[] | undefined> },
    payload: CreatorRefreshTokenPayload,
  ) {
    if (payload.type !== 'creator') {
      return null;
    }

    const creator = await this.prisma.creator.findUnique({
      where: { id: payload.sub },
    });

    if (!creator || !creator.refreshToken || !creator.refreshTokenId) {
      return null;
    }

    // Reject suspended or unapproved creators
    if (!creator.isActive || !creator.isApproved) {
      return null;
    }

    // Verify refresh token id matches before doing the expensive bcrypt compare
    if (creator.refreshTokenId !== payload.refreshId) {
      return null;
    }

    // Extract raw token from Authorization header and verify against the stored hash
    const rawAuthHeader =
      req.headers?.['authorization'] ?? req.headers?.['Authorization'];
    const authHeader: string | undefined = Array.isArray(rawAuthHeader)
      ? rawAuthHeader[0]
      : rawAuthHeader;
    const rawToken = authHeader?.replace(/^Bearer\s+/i, '');
    if (!rawToken) {
      return null;
    }

    const tokenMatches = await bcrypt.compare(rawToken, creator.refreshToken);
    if (!tokenMatches) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      type: payload.type,
      refreshId: payload.refreshId,
    };
  }
}
