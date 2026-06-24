import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { CacheService } from 'src/modules/infrastructure/cache/cache.service';
import { WishlistResponseDto } from './dto/wishlist.dto';

const WISHLIST_CACHE_PREFIX = 'user:wishlist:';

type WishlistItemWithRelations = {
  id: string;
  productId: string;
  variantId: string | null;
  createdAt: Date;
  product: {
    name: string;
    slug: string;
    price: Prisma.Decimal;
    hasVariants: boolean;
  };
  variant: {
    options: Prisma.JsonValue;
  } | null;
};

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async add(
    userId: string,
    productId: string,
    variantId?: string,
  ): Promise<WishlistResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
      });
      if (!variant) throw new NotFoundException('Product variant not found');
      if (variant.productId !== productId)
        throw new BadRequestException(
          'Variant does not belong to the specified product',
        );
    }

    try {
      const item = await this.prisma.wishlistItem.create({
        data: { userId, productId, variantId: variantId ?? null },
        include: {
          product: {
            select: {
              name: true,
              slug: true,
              price: true,
              hasVariants: true,
            },
          },
          variant: { select: { options: true } },
        },
      });

      // Invalidate wishlist cache
      await this.cacheService.del(`${WISHLIST_CACHE_PREFIX}${userId}`);

      return this.toResponseDto(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Item already in wishlist');
      }
      throw error;
    }
  }

  async findMine(userId: string): Promise<WishlistResponseDto[]> {
    const cacheKey = `${WISHLIST_CACHE_PREFIX}${userId}`;

    return this.cacheService.wrap(cacheKey, 300, async () => {
      const items = await this.prisma.wishlistItem.findMany({
        where: { userId },
        include: {
          product: {
            select: {
              name: true,
              slug: true,
              price: true,
              hasVariants: true,
            },
          },
          variant: { select: { options: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return items.map((item) => this.toResponseDto(item));
    });
  }

  async remove(
    userId: string,
    productId: string,
    variantId?: string,
  ): Promise<void> {
    const item = await this.prisma.wishlistItem.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId ?? null,
      },
    });
    if (!item) throw new NotFoundException('Item not found in wishlist');
    await this.prisma.wishlistItem.delete({ where: { id: item.id } });

    // Invalidate wishlist cache
    await this.cacheService.del(`${WISHLIST_CACHE_PREFIX}${userId}`);
  }

  private toResponseDto(item: WishlistItemWithRelations): WishlistResponseDto {
    return {
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productName: item.product.name,
      productSlug: item.product.slug,
      productPrice: Number(item.product.price),
      variantName: item.variant?.options
        ? Object.values(item.variant.options as Record<string, string>).join(
            ', ',
          )
        : null,
      createdAt: item.createdAt,
    };
  }
}
