import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export type CreatorJwtPayload = {
  sub: string;
  email: string;
  type: 'creator';
};

@Injectable()
export class CreatorJwtStrategy extends PassportStrategy(
  Strategy,
  'creator-jwt',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow('JWT_SECRET'),
    });
  }

  validate(payload: CreatorJwtPayload) {
    if (payload.type !== 'creator') {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      type: payload.type,
    };
  }
}
