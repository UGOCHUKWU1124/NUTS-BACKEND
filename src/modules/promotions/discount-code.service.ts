import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  DiscountCodeType,
  DiscountCodeScope,
  DiscountCode,
} from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { CreateAdminDiscountCodeDto } from './dto/create-admin-discount-code.dto';
import { CreateCreatorDiscountCodeDto } from './dto/create-creator-discount-code.dto';
import { DiscountCodeResponseDto } from './dto/discount-code-response.dto';

const discountCodeSelect = {
  id: true,
  code: true,
  description: true,
  type: true,
  value: true,
  maxDiscountAmount: true,
  minOrderAmount: true,
  usageLimit: true,
  usageCount: true,
  isActive: true,
  platformwide: true,
  startsAt: true,
  expiresAt: true,
  scope: true,
  applicableProductIds: true,
  creatorId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DiscountCodeSelect;

@Injectable()
export class DiscountCodeService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(
    code: DiscountCode & { _count?: { discountCodeUsages: number } },
  ): DiscountCodeResponseDto {
    return {
      id: code.id,
      code: code.code,
      description: code.description,
      type: code.type,
      value: Number(code.value),
      maxDiscountAmount: code.maxDiscountAmount
        ? Number(code.maxDiscountAmount)
        : null,
      minOrderAmount: code.minOrderAmount ? Number(code.minOrderAmount) : null,
      usageLimit: code.usageLimit,
      usageCount: code.usageCount,
      isActive: code.isActive,
      platformwide: code.platformwide,
      startsAt: code.startsAt,
      expiresAt: code.expiresAt,
      scope: code.scope,
      applicableProductIds: code.applicableProductIds,
      creatorId: code.creatorId,
      createdAt: code.createdAt,
      updatedAt: code.updatedAt,
      usages: code._count?.discountCodeUsages,
    };
  }

  async createForAdmin(
    dto: CreateAdminDiscountCodeDto,
  ): Promise<DiscountCodeResponseDto> {
    const discountCode = await this.prisma.discountCode.create({
      data: {
        code: dto.code,
        description: dto.description?.trim() || null,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        maxDiscountAmount: dto.maxDiscountAmount
          ? new Prisma.Decimal(dto.maxDiscountAmount)
          : null,
        minOrderAmount: dto.minOrderAmount
          ? new Prisma.Decimal(dto.minOrderAmount)
          : new Prisma.Decimal(0),
        usageLimit: dto.usageLimit ?? null,
        isActive: dto.isActive ?? true,
        platformwide: true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        scope: DiscountCodeScope.PLATFORM,
        applicableProductIds: [],
        creatorId: null,
      },
      select: discountCodeSelect,
    });

    return this.toResponse(discountCode);
  }

  async createForCreator(
    creatorId: string,
    dto: CreateCreatorDiscountCodeDto,
  ): Promise<DiscountCodeResponseDto> {
    const applicableProductIds = dto.applicableProductIds ?? [];

    // If product IDs are provided, verify every ID belongs to this creator
    if (applicableProductIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: applicableProductIds },
          creatorId,
        },
        select: { id: true },
      });

      if (products.length !== applicableProductIds.length) {
        throw new ForbiddenException(
          'One or more products do not belong to you',
        );
      }
    }

    const discountCode = await this.prisma.discountCode.create({
      data: {
        code: dto.code,
        description: dto.description?.trim() || null,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        maxDiscountAmount: dto.maxDiscountAmount
          ? new Prisma.Decimal(dto.maxDiscountAmount)
          : null,
        minOrderAmount: dto.minOrderAmount
          ? new Prisma.Decimal(dto.minOrderAmount)
          : new Prisma.Decimal(0),
        usageLimit: dto.usageLimit ?? null,
        isActive: dto.isActive ?? true,
        platformwide: applicableProductIds.length === 0,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        scope: DiscountCodeScope.CREATOR,
        applicableProductIds,
        creatorId,
      },
      select: discountCodeSelect,
    });

    return this.toResponse(discountCode);
  }

  async validate(
    code: string,
    userId: string,
    orderTotal: Prisma.Decimal,
  ): Promise<DiscountCode> {
    const normalized = code.trim().toUpperCase();
    const discountCode = await this.prisma.discountCode.findUnique({
      where: { code: normalized },
    });

    if (!discountCode) {
      throw new NotFoundException('Discount code not found');
    }

    if (!discountCode.isActive) {
      throw new BadRequestException('This discount code is inactive');
    }

    const now = new Date();
    if (discountCode.startsAt && discountCode.startsAt > now) {
      throw new BadRequestException('This discount code has not started yet');
    }
    if (discountCode.expiresAt && discountCode.expiresAt < now) {
      throw new BadRequestException('This discount code has expired');
    }

    // Check per-user usage limit
    const userUsageCount = await this.prisma.discountCodeUsage.count({
      where: {
        discountCodeId: discountCode.id,
        userId,
      },
    });
    if (
      discountCode.usageLimit !== null &&
      userUsageCount >= discountCode.usageLimit
    ) {
      throw new BadRequestException(
        'You have already used this discount code the maximum number of times',
      );
    }

    // Check minimum order amount
    const minOrderAmount = discountCode.minOrderAmount
      ? Number(discountCode.minOrderAmount)
      : 0;
    if (Number(orderTotal) < minOrderAmount) {
      throw new BadRequestException(
        'Your order total does not meet the minimum required amount for this discount code',
      );
    }

    return discountCode;
  }

  calculateDiscount(
    discountCode: DiscountCode,
    orderTotal: Prisma.Decimal,
  ): Prisma.Decimal {
    const total = Number(orderTotal);

    if (discountCode.type === DiscountCodeType.PERCENTAGE) {
      let discount = total * (Number(discountCode.value) / 100);
      if (discountCode.maxDiscountAmount) {
        discount = Math.min(discount, Number(discountCode.maxDiscountAmount));
      }
      return new Prisma.Decimal(Math.round(discount * 100) / 100);
    }

    // FIXED type
    const flatDiscount = Math.min(Number(discountCode.value), total);
    return new Prisma.Decimal(Math.round(flatDiscount * 100) / 100);
  }

  async recordUsage(
    discountCodeId: string,
    orderId: string,
    userId: string,
    discountAmount: Prisma.Decimal,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (tx) {
      await tx.discountCode.update({
        where: { id: discountCodeId },
        data: { usageCount: { increment: 1 } },
      });
      await tx.discountCodeUsage.create({
        data: {
          discountCodeId,
          orderId,
          userId,
          discountAmount,
        },
      });
    } else {
      await this.prisma.$transaction([
        this.prisma.discountCode.update({
          where: { id: discountCodeId },
          data: { usageCount: { increment: 1 } },
        }),
        this.prisma.discountCodeUsage.create({
          data: {
            discountCodeId,
            orderId,
            userId,
            discountAmount,
          },
        }),
      ]);
    }
  }

  async findAllForAdmin(): Promise<DiscountCodeResponseDto[]> {
    const codes = await this.prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        ...discountCodeSelect,
        _count: { select: { discountCodeUsages: true } },
      },
    });
    return codes.map((code) => this.toResponse(code));
  }

  async findAllForCreator(
    creatorId: string,
  ): Promise<DiscountCodeResponseDto[]> {
    const codes = await this.prisma.discountCode.findMany({
      where: { creatorId },
      orderBy: { createdAt: 'desc' },
      select: {
        ...discountCodeSelect,
        _count: { select: { discountCodeUsages: true } },
      },
    });
    return codes.map((code) => this.toResponse(code));
  }

  async deactivate(
    id: string,
    actorId?: string,
    isAdmin?: boolean,
  ): Promise<void> {
    if (!isAdmin) {
      const code = await this.prisma.discountCode.findUnique({
        where: { id },
        select: { creatorId: true },
      });
      if (!code) throw new NotFoundException('Discount code not found');
      if (code.creatorId !== actorId) {
        throw new ForbiddenException(
          'You do not have permission to manage this discount code',
        );
      }
    }

    await this.prisma.discountCode.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async remove(id: string, actorId?: string, isAdmin?: boolean): Promise<void> {
    const code = await this.prisma.discountCode.findUnique({
      where: { id },
      select: {
        creatorId: true,
        usageCount: true,
        _count: { select: { discountCodeUsages: true } },
      },
    });

    if (!code) throw new NotFoundException('Discount code not found');

    const usageCount =
      code.usageCount > 0 ? code.usageCount : code._count.discountCodeUsages;
    if (usageCount > 0) {
      throw new BadRequestException(
        'Cannot delete a discount code that has been used. Deactivate it instead.',
      );
    }

    if (!isAdmin) {
      if (code.creatorId !== actorId) {
        throw new ForbiddenException(
          'You do not have permission to manage this discount code',
        );
      }
    }

    await this.prisma.discountCode.delete({ where: { id } });
  }
}
