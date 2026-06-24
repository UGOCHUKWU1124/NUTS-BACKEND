import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from 'src/modules/shared/decorators/public.decorator';
import { AUTH_STRATEGY_KEY } from 'src/modules/shared/decorators/auth-strategy.decorator';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const authStrategy = this.reflector.getAllAndOverride<string>(
      AUTH_STRATEGY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (authStrategy && authStrategy !== 'jwt') {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null | undefined,
  ): TUser {
    if (err || !user) {
      this.logger.warn('Unauthorized request blocked');

      if (err instanceof Error) throw err;
      throw new UnauthorizedException('Unauthorized');
    }

    return user;
  }
}
