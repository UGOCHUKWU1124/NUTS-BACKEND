import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ROLE } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import {
  AuditLogService,
  type AuditChanges,
  toAuditPayload,
} from 'src/modules/shared/audit-log/audit-log.service';
import { UserResponseDto } from './dto/user-response.dto';
import { UserListItemResponseDto } from './dto/user-list-item-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUserDto } from './dto/query-user.dto';

import { DeactivateAccountResponseDto } from './dto/deactivate-account-response.dto';
import { PaginationMetaDto } from 'src/modules/shared/dto/pagination-meta.dto';
import { createPaginationMeta } from 'src/modules/shared/utils/pagination-meta.util';
import { getPagination } from 'src/modules/shared/utils/pagination.util';
import { DEFAULT_ACCOUNT_DELETION_GRACE_DAYS } from './constants/account-lifecycle.constants';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from 'src/modules/shared/constants/bcrypt.constants';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  private readonly shippingAddressOrderBy: Prisma.ShippingAddressOrderByWithRelationInput[] =
    [{ isDefault: 'desc' }, { updatedAt: 'desc' }];

  /** Light select for profile responses — only fields used in toResponseDto. */
  private readonly profileSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    role: true,
    createdAt: true,
  } as const;

  /** Full select for admin listing and internal operations. */
  private readonly userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    role: true,
    isActive: true,
    deactivatedAt: true,
    scheduledPermanentDeleteAt: true,
    createdAt: true,
    updatedAt: true,
    shippingAddresses: {
      orderBy: this.shippingAddressOrderBy,
      select: {
        id: true,
        fullName: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        country: true,
        isDefault: true,
      },
    },
    referralCode: {
      select: { code: true },
    },
  } as const;

  private readonly userListSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    role: true,
    isActive: true,
    deactivatedAt: true,
    scheduledPermanentDeleteAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  //get user by id
  async findOne(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: this.profileSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toResponseDto(user);
  }

  //get all users
  async findAll(query: QueryUserDto): Promise<{
    data: UserListItemResponseDto[];
    meta: PaginationMetaDto;
  }> {
    const { page = 1, limit = 10, search, role, isActive } = query;
    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        ...getPagination(page, limit),
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          deactivatedAt: true,
          scheduledPermanentDeleteAt: true,
          createdAt: true,
          updatedAt: true,
        }, // Only fetch needed fields for list view
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data: users,
      meta: createPaginationMeta(total, page, limit),
    };
  }

  //update user
  async update(
    userId: string,
    dto: UpdateUserDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserResponseDto> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) throw new NotFoundException('User not found');
    if (!existing.isActive) {
      if (this.isPastPermanentDeletion(existing.scheduledPermanentDeleteAt)) {
        throw new BadRequestException('Account has been permanently removed');
      }
      throw new BadRequestException(
        'Account is deactivated. Sign in again to reactivate before the scheduled deletion date.',
      );
    }
    // Only check email uniqueness if email is actually being changed
    if (dto.email && dto.email !== existing.email) {
      const taken = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException('Email is already in use');
      }
    }

    // Remove unnecessary transaction for simple update
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: this.userSelect,
    });

    // Build a diff of changed profile fields only
    const changedFields: AuditChanges = {};
    for (const [key, value] of Object.entries(dto)) {
      if (
        value !== undefined &&
        existing[key as keyof typeof existing] !== value
      ) {
        changedFields[key] = {
          old: (existing[key as keyof typeof existing] ??
            null) as AuditChanges[string]['old'],
          new: value as AuditChanges[string]['new'],
        };
      }
    }

    if (Object.keys(changedFields).length > 0) {
      await this.auditLog.log({
        action: 'UPDATE_PROFILE',
        entity: 'User',
        entityId: userId,
        userId,
        payload: toAuditPayload({ changes: changedFields }),
        ipAddress,
        userAgent,
      });
    }

    return this.toResponseDto(updatedUser);
  }

  private toResponseDto(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    role: ROLE;
    createdAt: Date;
  }): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phone,
      role: user.role,
      isVerified: false,
      createdAt: user.createdAt,
    };
  }

  //change user password
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const { currentPassword, newPassword } = dto;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) {
      if (this.isPastPermanentDeletion(user.scheduledPermanentDeleteAt)) {
        throw new BadRequestException('Account has been permanently removed');
      }
      throw new BadRequestException(
        'Account is deactivated. Sign in again to reactivate before the scheduled deletion date.',
      );
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS),
        refreshToken: null,
        refreshTokenId: null,
      },
    });

    await this.auditLog.log({
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: userId,
      userId,
      ipAddress,
      userAgent,
    });
  }

  // User self-deactivate
  async deactivate(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DeactivateAccountResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive)
      throw new BadRequestException('Account is already deactivated');
    if (user.role === ROLE.ADMIN)
      throw new ConflictException('Admin accounts cannot be self-deactivated');

    const scheduledPermanentDeleteAt = this.computeScheduledDeletionDate();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        scheduledPermanentDeleteAt,
        deactivatedBy: null, // self-deactivated
        deactivationReason: null,
        refreshToken: null,
        refreshTokenId: null,
      },
    });

    await this.auditLog.log({
      action: 'SELF_DEACTIVATE_USER',
      entity: 'User',
      entityId: userId,
      userId,
      ipAddress,
      userAgent,
    });

    const graceDays = this.getDeletionGraceDays();
    return {
      message: `Account deactivated. It will be permanently deleted after ${graceDays} days unless you sign in again to reactivate.`,
      scheduledPermanentDeleteAt,
    };
  }

  // User self-reactivate
  async reactivate(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new BadRequestException('Invalid email or password');
    }
    if (user.isActive)
      throw new BadRequestException('Account is already active');
    if (this.isPastPermanentDeletion(user.scheduledPermanentDeleteAt)) {
      throw new BadRequestException(
        'Account grace period has ended and can no longer be reactivated',
      );
    }

    // Block self-reactivation if deactivated by admin
    if (user.deactivatedBy) {
      throw new BadRequestException(
        'Your account was deactivated by an admin. Please contact support to reactivate.',
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        deactivatedAt: null,
        scheduledPermanentDeleteAt: null,
        deactivatedBy: null,
        deactivationReason: null,
      },
      select: this.userSelect,
    });

    await this.auditLog.log({
      action: 'SELF_REACTIVATE_USER',
      entity: 'User',
      entityId: user.id,
      userId: user.id,
      ipAddress,
      userAgent,
    });

    return this.toResponseDto(updatedUser);
  }

  //permanent delete current user account
  async permanentDelete(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === ROLE.ADMIN) {
      throw new ConflictException('Cannot permanently delete an admin account');
    }
    await this.prisma.user.delete({ where: { id: userId } });

    await this.auditLog.log({
      action: 'SELF_PERMANENT_DELETE_USER',
      entity: 'User',
      entityId: userId,
      userId,
      ipAddress,
      userAgent,
    });
  }

  //admin deactivate user account
  async adminDeactivate(
    adminId: string,
    userId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<DeactivateAccountResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive)
      throw new BadRequestException('Account is already deactivated');
    if (user.role === ROLE.ADMIN)
      throw new ConflictException('Cannot deactivate an admin account');

    const beforeState = {
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt,
      deactivatedBy: user.deactivatedBy,
      deactivationReason: user.deactivationReason,
    };

    const scheduledPermanentDeleteAt = this.computeScheduledDeletionDate();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        scheduledPermanentDeleteAt,
        deactivatedBy: adminId, // track who did it
        deactivationReason: reason,
        refreshToken: null,
        refreshTokenId: null,
      },
    });

    await this.auditLog.log({
      action: 'ADMIN_DEACTIVATE_USER',
      entity: 'User',
      entityId: userId,
      adminId,
      payload: toAuditPayload({
        reason,
        changes: {
          isActive: { old: beforeState.isActive, new: false },
          deactivatedBy: {
            old: beforeState.deactivatedBy ?? null,
            new: adminId,
          },
          deactivationReason: {
            old: beforeState.deactivationReason ?? null,
            new: reason,
          },
        },
      }),
      ipAddress,
      userAgent,
    });

    const graceDays = this.getDeletionGraceDays();
    return {
      message: `Account deactivated by admin. Permanent deletion in ${graceDays} days unless reactivated by an admin.`,
      scheduledPermanentDeleteAt,
    };
  }

  //admin reactivate user account
  async adminReactivate(
    userId: string,
    adminId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isActive)
      throw new BadRequestException('Account is already active');
    if (this.isPastPermanentDeletion(user.scheduledPermanentDeleteAt)) {
      throw new BadRequestException(
        'Account is past the scheduled deletion date and can no longer be reactivated',
      );
    }

    const beforeState = {
      isActive: user.isActive,
      deactivatedBy: user.deactivatedBy,
      deactivationReason: user.deactivationReason,
    };

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        deactivatedAt: null,
        scheduledPermanentDeleteAt: null,
        deactivatedBy: null,
        deactivationReason: null,
      },
      select: this.userSelect,
    });

    await this.auditLog.log({
      action: 'ADMIN_REACTIVATE_USER',
      entity: 'User',
      entityId: userId,
      adminId,
      payload: toAuditPayload({
        changes: {
          isActive: { old: beforeState.isActive, new: true },
          deactivatedBy: { old: beforeState.deactivatedBy ?? null, new: null },
          deactivationReason: {
            old: beforeState.deactivationReason ?? null,
            new: null,
          },
        },
      }),
      ipAddress,
      userAgent,
    });

    return this.toResponseDto(updatedUser);
  }

  //permanent delete user account
  async permanentRemove(
    userId: string,
    adminId?: string,
    ipAddress?: string,
    userAgent?: string,
    preloadedUser?: {
      role: ROLE;
      orders: { id: string }[];
      carts: { id: string }[];
      payments: { id: string }[];
    },
  ): Promise<void> {
    const user =
      preloadedUser ??
      (await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          orders: { select: { id: true }, take: 1 },
          carts: { select: { id: true }, take: 1 },
          payments: { select: { id: true }, take: 1 },
        },
      }));
    if (!user) throw new NotFoundException('User not found');
    if (user.role === ROLE.ADMIN) {
      throw new ConflictException('Cannot permanently delete an admin account');
    }
    this.assertNoRelatedRecords(user);
    await this.prisma.user.delete({ where: { id: userId } });

    await this.auditLog.log({
      action: 'ADMIN_PERMANENT_DELETE_USER',
      entity: 'User',
      entityId: userId,
      adminId,
      ipAddress,
      userAgent,
    });
  }

  //purge scheduled deletions i.e. delete user account if it is past the scheduled deletion date
  async purgeScheduledDeletions(): Promise<number> {
    const due = await this.prisma.user.findMany({
      where: {
        isActive: false,
        scheduledPermanentDeleteAt: { lte: new Date() },
      },
      include: {
        orders: { select: { id: true }, take: 1 },
        carts: { select: { id: true }, take: 1 },
        payments: { select: { id: true }, take: 1 },
      },
    });
    let deleted = 0;
    for (const user of due) {
      try {
        await this.permanentRemove(
          user.id,
          undefined,
          undefined,
          undefined,
          user,
        );
        deleted++;
      } catch (error) {
        this.logger.error(
          `Failed to purge scheduled deletion for user ${user.email} (${user.id})`,
          error instanceof Error ? error.stack : error,
        );
      }
    }
    return deleted;
  }

  //assert active account
  async assertActiveAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, scheduledPermanentDeleteAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) {
      if (this.isPastPermanentDeletion(user.scheduledPermanentDeleteAt)) {
        throw new BadRequestException('Account has been permanently removed');
      }
      throw new BadRequestException(
        'Account is deactivated. Sign in again to reactivate before the scheduled deletion date.',
      );
    }
  }

  //check if permanent deletion is past the scheduled deletion date
  isPastPermanentDeletion(scheduledAt: Date | null): boolean {
    return !!scheduledAt && scheduledAt <= new Date();
  }

  //compute scheduled deletion date
  private computeScheduledDeletionDate(): Date {
    const days = this.getDeletionGraceDays();
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  //get deletion grace days
  private getDeletionGraceDays(): number {
    const configured = this.config.get<number>('ACCOUNT_DELETION_GRACE_DAYS');
    return configured && configured > 0
      ? configured
      : DEFAULT_ACCOUNT_DELETION_GRACE_DAYS;
  }

  //assert no related records
  private assertNoRelatedRecords(user: {
    role: ROLE;
    orders: { id: string }[];
    carts: { id: string }[];
    payments: { id: string }[];
  }): void {
    if (user.orders.length || user.carts.length || user.payments.length) {
      throw new ConflictException(
        'Cannot permanently delete user with existing orders, carts, or payments',
      );
    }
  }
}
