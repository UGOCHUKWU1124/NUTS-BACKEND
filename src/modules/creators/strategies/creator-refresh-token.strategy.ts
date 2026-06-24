import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
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

  async validate(req: any, payload: CreatorRefreshTokenPayload) {
    if (payload.type !== 'creator') {
      return null;
    }

    const creator = await this.prisma.creator.findUnique({
      where: { id: payload.sub },
    });

    if (!creator || !creator.refreshToken || !creator.refreshTokenId) {
      return null;
    }

    if (creator.refreshTokenId !== payload.refreshId) {
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
