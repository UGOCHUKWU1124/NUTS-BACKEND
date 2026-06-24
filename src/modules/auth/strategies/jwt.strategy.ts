import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { ACCESS_TOKEN_COOKIE } from '../constants/auth-cookies.constants';
import { jwtFromCookieOrBearer } from '../utils/jwt-extractors';
import { AuthSessionService } from '../services/auth-session.service';
import { JwtPayload } from 'src/modules/shared/search/jwt-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authSessionService: AuthSessionService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: jwtFromCookieOrBearer(ACCESS_TOKEN_COOKIE),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    return this.authSessionService.validateAccessToken(payload);
  }
}
