import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import {
  AuditLogService,
  toAuditPayload,
} from 'src/modules/shared/audit-log/audit-log.service';
import { Prisma } from '@prisma/client';
import { createPaginationMeta } from 'src/modules/shared/utils/pagination-meta.util';
import { getPagination } from 'src/modules/shared/utils/pagination.util';
import { QueryAdminCreatorsDto } from './dto/query-admin-creators.dto';
import { CreatorProfileDto } from 'src/modules/creators/dto/creator-response.dto';
import { CreatorStatusResponseDto } from 'src/modules/creators/dto/creator-status-response.dto';

const creatorSelect = {
  id: true,
  email: true,
  storeName: true,
  storeSlug: true,
  storeDescription: true,
  businessPhone: true,
  businessEmail: true,
  storeLogoUrl: true,
  storeLogoAltText: true,
  isVerified: true,
  isActive: true,
  isApproved: true,
  firstName: true,
  lastName: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CreatorSelectPayload = Prisma.CreatorGetPayload<{
  select: typeof creatorSelect;
}>;

@Injectable()
export class AdminCreatorsService {
  private readonly creatorSelect = creatorSelect;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(query: QueryAdminCreatorsDto): Promise<{
    data: CreatorProfileDto[];
    meta: ReturnType<typeof createPaginationMeta>;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      isActive,
      isApproved,
      isVerified,
    } = query;

    const where: Prisma.CreatorWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { storeName: { contains: search, mode: 'insensitive' } },
        { storeSlug: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isApproved !== undefined) {
      where.isApproved = isApproved;
    }

    if (isVerified !== undefined) {
      where.isVerified = isVerified;
    }

    const [total, creators] = await this.prisma.$transaction([
      this.prisma.creator.count({ where }),
      this.prisma.creator.findMany({
        where,
        select: this.creatorSelect,
        orderBy: { createdAt: 'desc' },
        ...getPagination(page, limit),
      }),
    ]);

    return {
      data: creators.map((creator) => this.toCreatorProfile(creator)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string): Promise<CreatorProfileDto> {
    const creator = await this.prisma.creator.findUnique({
      where: { id },
      select: this.creatorSelect,
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return this.toCreatorProfile(creator);
  }

  async approve(
    adminId: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorStatusResponseDto> {
    const before = await this.prisma.creator.findUnique({
      where: { id },
      select: { isApproved: true },
    });

    const creator = await this.prisma.creator.update({
      where: { id },
      data: { isApproved: true },
      select: {
        id: true,
        isActive: true,
        isApproved: true,
        isVerified: true,
        updatedAt: true,
        email: true,
        storeName: true,
      },
    });

    await this.auditLog.log({
      action: 'APPROVE_CREATOR',
      entity: 'Creator',
      entityId: id,
      adminId,
      payload: toAuditPayload({
        email: creator.email,
        storeName: creator.storeName,
        changes: {
          isApproved: { old: before?.isApproved ?? false, new: true },
        },
      }),
      ipAddress,
      userAgent,
    });

    return {
      id: creator.id,
      isActive: creator.isActive,
      isApproved: creator.isApproved,
      isVerified: creator.isVerified,
      updatedAt: creator.updatedAt,
    };
  }

  async verify(
    adminId: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorStatusResponseDto> {
    const before = await this.prisma.creator.findUnique({
      where: { id },
      select: { isVerified: true },
    });

    const creator = await this.prisma.creator.update({
      where: { id },
      data: { isVerified: true },
      select: {
        id: true,
        isActive: true,
        isApproved: true,
        isVerified: true,
        updatedAt: true,
        email: true,
        storeName: true,
      },
    });

    await this.auditLog.log({
      action: 'VERIFY_CREATOR',
      entity: 'Creator',
      entityId: id,
      adminId,
      payload: toAuditPayload({
        email: creator.email,
        storeName: creator.storeName,
        changes: {
          isVerified: { old: before?.isVerified ?? false, new: true },
        },
      }),
      ipAddress,
      userAgent,
    });

    return {
      id: creator.id,
      isActive: creator.isActive,
      isApproved: creator.isApproved,
      isVerified: creator.isVerified,
      updatedAt: creator.updatedAt,
    };
  }

  async deactivate(
    adminId: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorStatusResponseDto> {
    const before = await this.prisma.creator.findUnique({
      where: { id },
      select: { isActive: true },
    });

    const creator = await this.prisma.creator.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        isActive: true,
        isApproved: true,
        isVerified: true,
        updatedAt: true,
        email: true,
        storeName: true,
      },
    });

    await this.auditLog.log({
      action: 'DEACTIVATE_CREATOR',
      entity: 'Creator',
      entityId: id,
      adminId,
      payload: toAuditPayload({
        email: creator.email,
        storeName: creator.storeName,
        changes: {
          isActive: { old: before?.isActive ?? true, new: false },
        },
      }),
      ipAddress,
      userAgent,
    });

    return {
      id: creator.id,
      isActive: creator.isActive,
      isApproved: creator.isApproved,
      isVerified: creator.isVerified,
      updatedAt: creator.updatedAt,
    };
  }

  async reactivate(
    adminId: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorStatusResponseDto> {
    const before = await this.prisma.creator.findUnique({
      where: { id },
      select: { isActive: true },
    });

    const creator = await this.prisma.creator.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        isActive: true,
        isApproved: true,
        isVerified: true,
        updatedAt: true,
        email: true,
        storeName: true,
      },
    });

    await this.auditLog.log({
      action: 'REACTIVATE_CREATOR',
      entity: 'Creator',
      entityId: id,
      adminId,
      payload: toAuditPayload({
        email: creator.email,
        storeName: creator.storeName,
        changes: {
          isActive: { old: before?.isActive ?? false, new: true },
        },
      }),
      ipAddress,
      userAgent,
    });

    return {
      id: creator.id,
      isActive: creator.isActive,
      isApproved: creator.isApproved,
      isVerified: creator.isVerified,
      updatedAt: creator.updatedAt,
    };
  }

  async delete(
    adminId: string,
    id: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    let creator: { id: string; email: string; storeName: string };
    try {
      creator = await this.prisma.creator.delete({
        where: { id },
        select: { id: true, email: true, storeName: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Creator not found');
      }
      throw error;
    }

    await this.auditLog.log({
      action: 'DELETE_CREATOR',
      entity: 'Creator',
      entityId: id,
      adminId,
      payload: toAuditPayload({
        email: creator.email,
        storeName: creator.storeName,
      }),
      ipAddress,
      userAgent,
    });
  }

  private toCreatorProfile(creator: CreatorSelectPayload): CreatorProfileDto {
    return {
      id: creator.id,
      email: creator.email,
      storeName: creator.storeName,
      storeSlug: creator.storeSlug,
      storeDescription: creator.storeDescription,
      businessPhone: creator.businessPhone,
      businessEmail: creator.businessEmail,
      storeLogoUrl: creator.storeLogoUrl,
      storeLogoAltText: creator.storeLogoAltText,
      firstName: creator.firstName,
      lastName: creator.lastName,
      phone: creator.phone,
      isVerified: creator.isVerified,
      isActive: creator.isActive,
      isApproved: creator.isApproved,
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
    };
  }
}
