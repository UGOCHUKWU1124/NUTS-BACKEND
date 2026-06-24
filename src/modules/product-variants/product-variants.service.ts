import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { CacheService } from 'src/modules/infrastructure/cache/cache.service';
import { getStockStatus } from 'src/modules/shared/utils/stock-status.util';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import {
  VariantSummaryDto,
  ProductVariantListResponseDto,
  AllVariantsResponseDto,
} from './dto/variant-response.dto';
import { AdminVariantResponseDto } from './dto/admin-variant-response.dto';
import { CreatorVariantResponseDto } from './dto/creator-variant-response.dto';
import { PublicVariantResponseDto } from './dto/public-variant-response.dto';
import { getPagination } from 'src/modules/shared/utils/pagination.util';
import { createPaginationMeta } from 'src/modules/shared/utils/pagination-meta.util';
import {
  assertNoDuplicateVariantOptions,
  assertValidVariantOptions,
  normalizeOptions,
  type VariantOptions,
} from 'src/modules/shared/utils/variant-options.validator';
import { PRODUCT_TTL } from 'src/modules/shared/constants/cache.constant';

/**
 * Light variant select for product-level queries.
 */
const variantSelect = {
  id: true,
  options: true,
  stock: true,
  images: true,
  isActive: true,
  isDeleted: true,
} as const;

/**
 * Full variant select for admin queries (includes audit timestamps).
 */
const adminVariantSelect = {
  id: true,
  options: true,
  stock: true,
  images: true,
  isActive: true,
  isDeleted: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ── Include queries for product with minimal info ─────────────────────────────
const productForVariantSelect = {
  id: true,
  name: true,
  slug: true,
  hasVariants: true,
  images: { select: { url: true } },
  creator: { select: { id: true } },
} satisfies Prisma.ProductSelect;

const publicProductForVariantSelect = {
  id: true,
  name: true,
  slug: true,
  images: { select: { url: true } },
} satisfies Prisma.ProductSelect;

type VariantWithProduct = Prisma.ProductVariantGetPayload<{
  include: { product: { select: typeof productForVariantSelect } };
}>;

type PublicVariantWithProduct = Prisma.ProductVariantGetPayload<{
  include: { product: { select: typeof publicProductForVariantSelect } };
}>;

@Injectable()
export class ProductVariantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  // CREATE
  // ═════════════════════════════════════════════════════════════════════════

  async create(
    productId: string,
    dto: CreateVariantDto,
  ): Promise<AdminVariantResponseDto> {
    return this.createVariant(productId, dto);
  }

  async createForCreator(
    creatorId: string,
    productId: string,
    dto: CreateVariantDto,
  ): Promise<CreatorVariantResponseDto> {
    const product = await this.getProductOrThrow(productId);
    this.ensureCreatorOwnsProduct(product, creatorId);
    return this.createVariantForCreator(productId, dto);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // READ — Creator context
  // ═════════════════════════════════════════════════════════════════════════

  async findAllForCreator(
    creatorId: string,
    productId: string,
  ): Promise<ProductVariantListResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        slug: true,
        isDeleted: true,
        images: { select: { url: true } },
        creator: { select: { id: true } },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    if (product.creator.id !== creatorId) {
      throw new ForbiddenException('You do not own this product');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { productId, isDeleted: false },
      orderBy: { createdAt: 'asc' },
    });

    return {
      variants: variants.map((v) => this.toVariantSummaryDto(v)),
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.images?.[0]?.url ?? null,
      },
    };
  }

  async findOneForCreator(
    creatorId: string,
    variantId: string,
  ): Promise<CreatorVariantResponseDto> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, isDeleted: false },
      include: {
        product: { select: productForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    this.ensureCreatorOwnsProduct(variant.product, creatorId);
    return this.toCreatorResponseDto(variant);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // UPDATE — Creator context
  // ═════════════════════════════════════════════════════════════════════════

  async updateForCreator(
    creatorId: string,
    id: string,
    dto: UpdateVariantDto,
  ): Promise<CreatorVariantResponseDto> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      include: {
        product: { select: productForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    this.ensureCreatorOwnsProduct(variant.product, creatorId);

    if (dto.options) {
      assertValidVariantOptions(dto.options as unknown as VariantOptions);

      const existingVariants = await this.prisma.productVariant.findMany({
        where: {
          productId: variant.productId,
          isDeleted: false,
          id: { not: id },
        },
        select: { options: true },
      });

      assertNoDuplicateVariantOptions(
        dto.options as unknown as VariantOptions,
        existingVariants.map((v) => v.options),
      );
    }

    const data: Prisma.ProductVariantUpdateInput = {};
    if (dto.options !== undefined) data.options = dto.options as any;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.images !== undefined) data.images = dto.images;

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data,
      include: {
        product: { select: productForVariantSelect },
      },
    });

    await this.clearVariantCache(variant.productId, variant.product.slug);

    return this.toCreatorResponseDto(updated);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // DELETE (soft) — Creator context
  // ═════════════════════════════════════════════════════════════════════════

  async removeForCreator(creatorId: string, id: string): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      include: {
        product: { select: productForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    this.ensureCreatorOwnsProduct(variant.product, creatorId);

    await this.prisma.productVariant.update({
      where: { id },
      data: { isDeleted: true, isActive: false, deletedAt: new Date() },
    });

    await this.clearVariantCache(variant.productId, variant.product.slug);
  }

  async deactivateForCreator(
    creatorId: string,
    id: string,
  ): Promise<CreatorVariantResponseDto> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      include: {
        product: { select: productForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    this.ensureCreatorOwnsProduct(variant.product, creatorId);

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: { isActive: false },
      include: {
        product: { select: productForVariantSelect },
      },
    });

    await this.clearVariantCache(variant.productId, variant.product.slug);
    return this.toCreatorResponseDto(updated);
  }

  async reactivateForCreator(
    creatorId: string,
    id: string,
  ): Promise<CreatorVariantResponseDto> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      include: {
        product: { select: productForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    this.ensureCreatorOwnsProduct(variant.product, creatorId);

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: { isActive: true, isDeleted: false, deletedAt: null },
      include: {
        product: { select: productForVariantSelect },
      },
    });

    await this.clearVariantCache(variant.productId, variant.product.slug);
    return this.toCreatorResponseDto(updated);
  }

  async permanentRemoveForCreator(
    creatorId: string,
    id: string,
  ): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      include: {
        product: { select: productForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    this.ensureCreatorOwnsProduct(variant.product, creatorId);

    await this.prisma.productVariant.delete({ where: { id } });
    await this.clearVariantCache(variant.productId, variant.product.slug);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // READ — Public context
  // ═════════════════════════════════════════════════════════════════════════

  async findAll(productId: string): Promise<ProductVariantListResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
      select: {
        id: true,
        name: true,
        slug: true,
        isDeleted: true,
        images: { select: { url: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const variants = await this.prisma.productVariant.findMany({
      where: { productId, isDeleted: false, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      variants: variants.map((v) => this.toVariantSummaryDto(v)),
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.images?.[0]?.url ?? null,
      },
    };
  }

  async findAllPaginated(params: {
    page?: number;
    limit?: number;
  }): Promise<AllVariantsResponseDto> {
    const { page = 1, limit = 10 } = params;
    const where: Prisma.ProductVariantWhereInput = { isDeleted: false };

    const [total, variants] = await this.prisma.$transaction([
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        ...getPagination(page, limit),
      }),
    ]);

    return {
      data: variants.map((v) => this.toVariantSummaryDto(v)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  async findOne(id: string): Promise<PublicVariantResponseDto> {
    const cacheKey = `variant:id:${id}`;
    const cached =
      await this.cacheService.get<PublicVariantResponseDto>(cacheKey);
    if (cached) return cached;

    const variant = await this.prisma.productVariant.findFirst({
      where: { id, isDeleted: false },
      include: {
        product: { select: publicProductForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const response = this.toPublicResponseDto(variant);
    await this.cacheService.set(cacheKey, response, PRODUCT_TTL);
    return response;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MUTATIONS — Admin context
  // ═════════════════════════════════════════════════════════════════════════

  async update(
    id: string,
    dto: UpdateVariantDto,
  ): Promise<AdminVariantResponseDto> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      include: {
        product: { select: productForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    if (dto.options) {
      assertValidVariantOptions(dto.options as unknown as VariantOptions);

      const existingVariants = await this.prisma.productVariant.findMany({
        where: {
          productId: variant.productId,
          isDeleted: false,
          id: { not: id },
        },
        select: { options: true },
      });

      assertNoDuplicateVariantOptions(
        dto.options as unknown as VariantOptions,
        existingVariants.map((v) => v.options),
      );
    }

    const data: Prisma.ProductVariantUpdateInput = {};
    if (dto.options !== undefined) data.options = dto.options as any;
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.images !== undefined) data.images = dto.images;

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data,
      include: {
        product: { select: productForVariantSelect },
      },
    });

    await this.clearVariantCache(variant.productId, variant.product.slug);
    return this.toAdminResponseDto(updated);
  }

  async updateStock(
    id: string,
    quantity: number,
    description?: string,
  ): Promise<{
    id: string;
    stock: number;
    updatedAt: Date;
    inStock: boolean;
    stockStatus: string;
  }> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      select: { id: true, stock: true, isActive: true, productId: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const newStock = variant.stock + quantity;
    if (newStock < 0) {
      throw new BadRequestException(
        `Insufficient stock: cannot adjust by ${quantity} from current level of ${variant.stock}`,
      );
    }

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: { stock: newStock },
      select: { id: true, stock: true, updatedAt: true, productId: true },
    });

    await this.prisma.stockHistory.create({
      data: {
        productId: updated.productId,
        variantId: updated.id,
        adjustment: quantity,
        oldStockQuantity: variant.stock,
        newStockQuantity: updated.stock,
        description:
          description ??
          (quantity >= 0
            ? 'Manual stock adjustment'
            : 'Manual stock reduction'),
      },
    });

    const { inStock, stockStatus } = getStockStatus(
      updated.stock,
      variant.isActive,
    );
    return {
      id: updated.id,
      stock: updated.stock,
      updatedAt: updated.updatedAt,
      inStock,
      stockStatus,
    };
  }

  async updateStockForCreator(
    creatorId: string,
    id: string,
    quantity: number,
    description?: string,
  ): Promise<{
    id: string;
    stock: number;
    updatedAt: Date;
    inStock: boolean;
    stockStatus: string;
  }> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      select: {
        id: true,
        stock: true,
        isActive: true,
        productId: true,
        product: { select: { creator: { select: { id: true } } } },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    if (variant.product.creator.id !== creatorId) {
      throw new ForbiddenException('You do not own this variant');
    }

    return this.updateStock(id, quantity, description);
  }

  async deactivate(id: string): Promise<AdminVariantResponseDto> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: { isActive: false },
      include: {
        product: { select: productForVariantSelect },
      },
    });

    await this.clearVariantCache(updated.productId, updated.product.slug);
    return this.toAdminResponseDto(updated);
  }

  async reactivate(id: string): Promise<AdminVariantResponseDto> {
    await this.prisma.productVariant.findFirst({ where: { id } });
    if (!(await this.prisma.productVariant.findFirst({ where: { id } }))) {
      throw new NotFoundException('Variant not found');
    }

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: { isActive: true, isDeleted: false, deletedAt: null },
      include: {
        product: { select: productForVariantSelect },
      },
    });

    await this.clearVariantCache(updated.productId, updated.product.slug);
    return this.toAdminResponseDto(updated);
  }

  async permanentRemove(id: string): Promise<void> {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id },
      include: {
        product: { select: productForVariantSelect },
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');

    await this.prisma.productVariant.delete({ where: { id } });
    await this.clearVariantCache(variant.productId, variant.product.slug);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  private async getProductOrThrow(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isDeleted: false },
      include: { creator: { select: { id: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private ensureCreatorOwnsProduct(
    product: { creator?: { id: string } | null },
    creatorId: string,
  ): void {
    if (product.creator?.id !== creatorId) {
      throw new ForbiddenException('You do not own this product');
    }
  }

  private async clearVariantCache(
    productId: string,
    productSlug: string,
  ): Promise<void> {
    await this.cacheService.del(`variant:product:${productId}`);
    await this.cacheService.delByPattern(`variant:id:*`);
    await this.cacheService.delByPattern(`product:slug:${productSlug}`);
    await this.cacheService.delByPattern('products:public:*');
  }

  private async createVariant(
    productId: string,
    dto: CreateVariantDto,
  ): Promise<AdminVariantResponseDto> {
    const product = await this.getProductOrThrow(productId);

    if (!product.hasVariants) {
      throw new BadRequestException(
        'Cannot add variants to a product that does not have hasVariants=true. Update the product first to enable variants.',
      );
    }

    if (dto.options) {
      assertValidVariantOptions(dto.options as unknown as VariantOptions);

      const existingVariants = await this.prisma.productVariant.findMany({
        where: { productId, isDeleted: false },
        select: { options: true },
      });

      assertNoDuplicateVariantOptions(
        dto.options as unknown as VariantOptions,
        existingVariants.map((v) => v.options),
      );
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        options: (dto.options ?? []).map((o) => ({
          name: o.name,
          value: o.value,
        })) as any,
        stock: dto.stock ?? 0,
        images: dto.images ?? [],
      },
      include: {
        product: { select: productForVariantSelect },
      },
    });

    await this.clearVariantCache(productId, product.slug);
    return this.toAdminResponseDto(variant);
  }

  private async createVariantForCreator(
    productId: string,
    dto: CreateVariantDto,
  ): Promise<CreatorVariantResponseDto> {
    const product = await this.getProductOrThrow(productId);

    if (!product.hasVariants) {
      throw new BadRequestException(
        'Cannot add variants to a product that does not have hasVariants=true.',
      );
    }

    if (dto.options) {
      assertValidVariantOptions(dto.options as unknown as VariantOptions);

      const existingVariants = await this.prisma.productVariant.findMany({
        where: { productId, isDeleted: false },
        select: { options: true },
      });

      assertNoDuplicateVariantOptions(
        dto.options as unknown as VariantOptions,
        existingVariants.map((v) => v.options),
      );
    }

    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        options: (dto.options ?? []).map((o) => ({
          name: o.name,
          value: o.value,
        })) as any,
        stock: dto.stock ?? 0,
        images: dto.images ?? [],
      },
      include: {
        product: { select: productForVariantSelect },
      },
    });

    await this.clearVariantCache(productId, product.slug);
    return this.toCreatorResponseDto(variant);
  }

  // ── Response mappers ──────────────────────────────────────────────────────

  private toVariantSummaryDto(variant: {
    id: string;
    options: Prisma.JsonValue;
    stock: number;
    images: string[];
    isActive: boolean;
    isDeleted: boolean;
    deletedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): VariantSummaryDto {
    const { inStock, stockStatus } = getStockStatus(
      variant.stock,
      variant.isActive && !variant.isDeleted,
    );

    return {
      id: variant.id,
      options: normalizeOptions(variant.options).map(({ name, value }) => ({
        name,
        value,
      })),
      stock: variant.stock,
      inStock,
      stockStatus,
      images: variant.images ?? [],
      isActive: variant.isActive,
      isDeleted: variant.isDeleted,
      deletedAt: variant.deletedAt ?? undefined,
      createdAt: variant.createdAt ?? new Date(),
      updatedAt: variant.updatedAt ?? new Date(),
    };
  }

  private toAdminResponseDto(
    variant: VariantWithProduct,
  ): AdminVariantResponseDto {
    const { inStock, stockStatus } = getStockStatus(
      variant.stock,
      variant.isActive && !variant.isDeleted,
    );

    return {
      id: variant.id,
      options: normalizeOptions(variant.options).map(({ name, value }) => ({
        name,
        value,
      })),
      stock: variant.stock,
      inStock,
      stockStatus,
      images: variant.images ?? [],
      product: {
        id: variant.product.id,
        name: variant.product.name,
        slug: variant.product.slug,
        imageUrl: variant.product.images?.[0]?.url ?? null,
      },
      isActive: variant.isActive,
      isDeleted: variant.isDeleted,
      deletedAt: variant.deletedAt ?? null,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }

  private toCreatorResponseDto(
    variant: VariantWithProduct,
  ): CreatorVariantResponseDto {
    const { inStock, stockStatus } = getStockStatus(
      variant.stock,
      variant.isActive && !variant.isDeleted,
    );

    return {
      id: variant.id,
      options: normalizeOptions(variant.options).map(({ name, value }) => ({
        name,
        value,
      })),
      stock: variant.stock,
      inStock,
      stockStatus,
      images: variant.images ?? [],
      product: {
        id: variant.product.id,
        name: variant.product.name,
        slug: variant.product.slug,
        imageUrl: variant.product.images?.[0]?.url ?? null,
      },
      isActive: variant.isActive,
      isDeleted: variant.isDeleted,
      deletedAt: variant.deletedAt ?? null,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }

  private toPublicResponseDto(
    variant: PublicVariantWithProduct,
  ): PublicVariantResponseDto {
    const { inStock, stockStatus } = getStockStatus(
      variant.stock,
      variant.isActive && !variant.isDeleted,
    );

    return {
      id: variant.id,
      options: normalizeOptions(variant.options).map(({ name, value }) => ({
        name,
        value,
      })),
      stock: variant.stock,
      inStock,
      stockStatus,
      images: variant.images ?? [],
      product: {
        id: variant.product.id,
        name: variant.product.name,
        slug: variant.product.slug,
        imageUrl: variant.product.images?.[0]?.url ?? null,
      },
      isActive: variant.isActive,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }
}
