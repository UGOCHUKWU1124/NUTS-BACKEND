import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';

import * as bcrypt from 'bcrypt';

import { ROLE } from '@prisma/client';
import { JwtPayload } from 'src/modules/shared/search/jwt-payload.type';
import { AuthenticatedUser } from '../types/authenticated-user.type';

type RefreshPayload = {
  sub: string;
  email: string;
  role?: ROLE;
  refreshId?: string;
};

type RefreshAccount = {
  id: string;
  email: string;
  role: ROLE;
  refreshToken: string | null;
  refreshTokenId: string | null;
  isActive: boolean;
};

/** Minimum shape required to construct an AuthenticatedUser. */
type AuthUserInput = {
  id: string;
  email: string;
  role: ROLE;
  firstName?: string | null;
  lastName?: string | null;
};

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async validateAccessToken(payload: JwtPayload) {
    const account =
      payload.role === ROLE.ADMIN
        ? await this.prisma.admin.findUnique({
            where: { id: payload.sub },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
              tokenVersion: true,
            },
          })
        : await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
            },
          });

    if (!account) throw new UnauthorizedException('User not found');
    if (!account.isActive)
      throw new UnauthorizedException('Account is deactivated');

    if (
      payload.role === ROLE.ADMIN &&
      typeof payload.tokenVersion !== 'number'
    ) {
      throw new UnauthorizedException('Invalid admin token');
    }

    if (payload.role === ROLE.ADMIN) {
      const adminAccount = account as unknown as { tokenVersion: number };

      if (adminAccount.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Admin token has been revoked');
      }
    }

    return this.toAuthUser(account);
  }

  async validateRefreshToken(
    account: RefreshAccount | null,
    refreshToken: string,
    payload: RefreshPayload,
  ): Promise<AuthenticatedUser> {
    if (!account?.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    this.assertActiveUser(account);

    const matches = await bcrypt.compare(refreshToken, account.refreshToken);

    if (!matches) {
      return this.revokeAndThrow(
        account.id,
        account.role,
        'Invalid refresh token',
      );
    }

    if (
      account.refreshTokenId &&
      payload.refreshId &&
      payload.refreshId !== account.refreshTokenId
    ) {
      return this.revokeAndThrow(
        account.id,
        account.role,
        'Refresh token reuse detected',
      );
    }

    return this.toAuthUser(account);
  }

  async revokeRefreshSession(userId: string, role: ROLE): Promise<void> {
    if (role === ROLE.ADMIN) {
      await this.prisma.admin.update({
        where: { id: userId },
        data: { refreshToken: null, refreshTokenId: null },
      });
      return;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, refreshTokenId: null },
    });
  }

  private assertActiveUser(user: { isActive: boolean }): void {
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
  }

  private revokeAndThrow(userId: string, role: ROLE, message: string): never {
    // Fire-and-forget: intentionally not awaited so the caller gets the
    // UnauthorizedException immediately without waiting for the DB write.
    void this.revokeRefreshSession(userId, role);
    throw new UnauthorizedException(message);
  }

  private toAuthUser(user: AuthUserInput): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
    };
  }
}
