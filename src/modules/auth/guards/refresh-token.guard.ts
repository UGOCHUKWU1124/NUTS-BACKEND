// Guard for protecting refresh token endpoints

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {
  override handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: TUser | false | null | undefined,
  ): TUser {
    if (err || !user) {
      if (err instanceof Error) throw err;
      throw new UnauthorizedException('Invalid refresh session');
    }
    return user;
  }
}
