import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLE } from '@prisma/client';
import { ROLES_KEY } from 'src/modules/shared/decorators/role.decorator';

type AuthUser = {
  id: string;
  email: string;
  role: ROLE;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<ROLE[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();

    const user = request.user;

    if (!user) return false;

    return requiredRoles.includes(user.role);
  }
}
