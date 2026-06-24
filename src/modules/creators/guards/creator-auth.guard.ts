import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/modules/shared/decorators/public.decorator';

@Injectable()
export class CreatorJwtAuthGuard
  extends AuthGuard('creator-jwt')
  implements CanActivate
{
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const result = (await super.canActivate(context)) as boolean;
    const request = context
      .switchToHttp()
      .getRequest<Record<string, unknown>>();
    const user = request.user;

    if (typeof user !== 'object' || user === null) {
      return false;
    }

    return result;
  }
}

@Injectable()
export class CreatorRefreshGuard extends AuthGuard('creator-refresh-token') {}
