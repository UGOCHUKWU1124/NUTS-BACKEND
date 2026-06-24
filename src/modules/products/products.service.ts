import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from '../category/categories.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { CacheService } from 'src/modules/infrastructure/cache/cache.service';
import {
  PRODUCT_BY_SLUG,
  PRODUCT_TTL,
} from 'src/modules/shared/constants/cache.constant';
import {
  resolveCategoryIdFromPath,
  buildCategoryPath,
} from 'src/modules/shared/utils/category-path.util';
import { getStockStatus } from 'src/modules/shared/utils/stock-status.util';
import { normalizeOptions } from 'src/modules/shared/utils/variant-options.validator';
import { computeVariantCombinations } from 'src/modules/shared/utils/variant-combinations.util';
import { mapPrismaError } from 'src/modules/shared/utils/prisma-error.util';
import { generateSlug } from 'src/modules/shared/utils/slug.util';
import { AdminCreateProductDto } from './dto/admin-create-product.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { PublicProductResponseDto } from './dto/public-product-response.dto';
import { CreatorProductResponseDto } from './dto/creator-product-response.dto';
import { AdminProductResponseDto } from './dto/admin-product-response.dto';
import { ProductReactivateResponseDto } from './dto/product-reactivate-response.dto';
import type { VariantSummaryDto } from 'src/modules/product-variants/dto/variant-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { StockUpdateResponseDto } from './dto/stock-update-response.dto';
import { createPaginationMeta } from 'src/modules/shared/utils/pagination-meta.util';
import { getPagination } from 'src/modules/shared/utils/pagination.util';
import { AuditLogService } from 'src/modules/shared/audit-log/audit-log.service';
import { SearchService } from 'src/modules/shared/search/search.service';

/** Light variant select for most contexts — omits internal audit timestamps */
const variantSelect = {
  id: true,
  options: true,
  stock: true,
  images: true,
  isActive: true,
  isDeleted: true,
} as const;

/** Full variant select for admin contexts — includes audit timestamps */
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

/** Lighter variant select for public endpoints — omits internal audit timestamps */
const publicVariantSelect = {
  id: true,
  options: true,
  stock: true,
  images: true,
  isActive: true,
  isDeleted: true,
} as const;

// ── Full product with creator (admin context) ──────────────────────────────
type ProductWithCategory = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true } };
    images: { select: { id: true; url: true; position: true } };
    creator: {
      select: {
        id: true;
        storeName: true;
        storeSlug: true;
        storeLogoUrl: true;
      };
    };
    variants: {
      select: typeof variantSelect;
      where: { isDeleted: false };
      orderBy: { createdAt: 'asc' };
    };
  };
}>;

// ── Public product with trimmed creator ────────────────────────────────────
type PublicProductWithCategory = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true } };
    images: { select: { id: true; url: true; position: true } };
    creator: {
      select: {
        id: true;
        storeName: true;
        storeSlug: true;
        storeLogoUrl: true;
      };
    };
    variants: {
      select: typeof publicVariantSelect;
      where: { isDeleted: false; isActive: true };
      orderBy: { createdAt: 'asc' };
    };
  };
}>;

// ── Creator-scoped product (no creator object in response, but included for indexing) ─────
type CreatorProductWithCategory = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true; slug: true } };
    images: { select: { id: true; url: true; position: true } };
    creator: {
      select: {
        id: true;
        storeName: true;
        storeSlug: true;
        storeLogoUrl: true;
      };
    };
    variants: {
      select: typeof publicVariantSelect;
      where: { isDeleted: false };
      orderBy: { createdAt: 'asc' };
    };
  };
}>;

@Injectable()
export class ProductsService {
  /** Full include with trimmed creator fields — used by admin & mutation methods. */
  private readonly productInclude = {
    category: { select: { id: true, name: true, slug: true } },
    images: { select: { id: true, url: true, position: true } },
    creator: {
      select: {
        id: true,
        storeName: true,
        storeSlug: true,
        storeLogoUrl: true,
      },
    },
    variants: {
      where: { isDeleted: false },
      orderBy: { createdAt: 'asc' },
      select: variantSelect,
    },
  } as const;

  /** Public include — only fetches creator fields exposed in CreatorSummaryDto. */
  private readonly publicProductInclude = {
    category: { select: { id: true, name: true, slug: true } },
    images: { select: { id: true, url: true, position: true } },
    creator: {
      select: {
        id: true,
        storeName: true,
        storeSlug: true,
        storeLogoUrl: true,
      },
    },
    variants: {
      where: { isDeleted: false, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: publicVariantSelect,
    },
  } as const;

  /** Creator-scoped include — includes creator for indexing, but creator is not exposed in response DTO. */
  private readonly creatorProductInclude = {
    category: { select: { id: true, name: true, slug: true } },
    images: { select: { id: true, url: true, position: true } },
    creator: {
      select: {
        id: true,
        storeName: true,
        storeSlug: true,
        storeLogoUrl: true,
      },
    },
    variants: {
      where: { isDeleted: false },
      orderBy: { createdAt: 'asc' },
      select: publicVariantSelect,
    },
  } as const;

  /** Admin list include — used for findAllForAdmin listing (lightweight creator, full variant select). */
  private readonly adminListInclude = {
    category: { select: { id: true, name: true, slug: true } },
    images: { select: { id: true, url: true, position: true } },
    creator: {
      select: {
        id: true,
        storeName: true,
        storeSlug: true,
        storeLogoUrl: true,
      },
    },
    variants: {
      where: { isDeleted: false },
      orderBy: { createdAt: 'asc' },
      select: adminVariantSelect,
    },
  } as const;

  private getPublicProductsCacheKey(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    inStock?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }): string {
    return `product:list:public:${params.page ?? 1}:${params.limit ?? 10}:search:${encodeURIComponent(
      params.search ?? '',
    )}:category:${params.categoryId ?? ''}:inStock:${params.inStock ?? ''}:minPrice:${
      params.minPrice ?? ''
    }:maxPrice:${params.maxPrice ?? ''}`;
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly searchService: SearchService,
    private readonly auditLog: AuditLogService,
    private readonly categoriesService: CategoriesService,
  ) {}

  // ═════════════════════════════════════════════════════════════════════════
  // CREATE (admin)
  // ═════════════════════════════════════════════════════════════════════════
  async create(
    dto: AdminCreateProductDto,
    adminId?: string,
  ): Promise<ProductResponseDto> {
    await this.categoriesService.assertLeafSubcategory(dto.categoryId!);

    const categoryId = await this.resolveCategoryId(dto);
    const slug = await this.resolveProductSlug(dto.name, categoryId, dto.slug);

    if (!dto.creatorId) {
      throw new BadRequestException(
        'creatorId is required when creating a product through admin API',
      );
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          hasVariants: dto.hasVariants ?? false,
          price: dto.price ?? 0,
          stock: dto.hasVariants ? 0 : (dto.stock ?? 0),
          sku: dto.sku,
          isActive: dto.isActive ?? true,
          categoryId,
          creatorId: dto.creatorId,
          images: dto.imageUrl
            ? {
                create: {
                  url: dto.imageUrl,
                  isPrimary: true,
                },
              }
            : undefined,
        },
        include: this.productInclude,
      });
      const response = this.toResponse(product);
      await this.cacheService.del(PRODUCT_BY_SLUG(product.slug));
      await this.cacheService.delByPattern('products:public:*');
      await this.cacheService.delByPattern(
        `creator:store:${product.creator.storeSlug}:products`,
      );

      await this.auditLog.log({
        action: 'CREATE_PRODUCT',
        entity: 'Product',
        entityId: product.id,
        adminId,
        payload: {
          name: product.name,
          sku: product.sku,
          creatorId: dto.creatorId,
        },
      });

      return response;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CREATE (creator)
  // ═════════════════════════════════════════════════════════════════════════
  async createForCreator(
    creatorId: string,
    dto: CreateProductDto,
  ): Promise<CreatorProductResponseDto> {
    await this.categoriesService.assertLeafSubcategory(dto.categoryId!);

    const categoryId = await this.resolveCategoryId(dto);
    const slug = await this.resolveProductSlug(dto.name, categoryId, dto.slug);

    try {
      const product = await this.prisma.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          hasVariants: dto.hasVariants ?? false,
          price: dto.price ?? 0,
          stock: dto.hasVariants ? 0 : (dto.stock ?? 0),
          sku: dto.sku,
          isActive: dto.isActive ?? true,
          categoryId,
          creatorId,
          images: dto.imageUrl
            ? {
                create: {
                  url: dto.imageUrl,
                  isPrimary: true,
                },
              }
            : undefined,
        },
        include: this.creatorProductInclude,
      });
      const response = this.toCreatorResponse(product);
      await this.cacheService.del(PRODUCT_BY_SLUG(product.slug));
      await this.cacheService.delByPattern('products:public:*');
      await this.cacheService.delByPattern(
        `creator:store:${creatorId}:products`,
      );

      await this.auditLog.log({
        action: 'CREATE_PRODUCT',
        entity: 'Product',
        entityId: product.id,
        adminId: creatorId,
        userId: creatorId,
        payload: { name: product.name, sku: product.sku, creatorId },
      });

      return response;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // READ — Public context (active products only, trimmed creator)
  // ═════════════════════════════════════════════════════════════════════════

  /** Public listing — active, non-deleted products with search & cache. */
  async findAllPublic(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    inStock?: boolean;
    minPrice?: number;
    maxPrice?: number;
    bypassCache?: boolean;
  }): Promise<{
    data: PublicProductResponseDto[];
    meta: ReturnType<typeof createPaginationMeta>;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      categoryId,
      inStock,
      minPrice,
      maxPrice,
    } = params;

    const cacheKey = this.getPublicProductsCacheKey({
      page,
      limit,
      search,
      categoryId,
      inStock,
      minPrice,
      maxPrice,
    });

    if (!params.bypassCache) {
      const cached = await this.cacheService.get<{
        data: PublicProductResponseDto[];
        meta: ReturnType<typeof createPaginationMeta>;
      }>(cacheKey);
      if (cached) return cached;
    }

    const whereBase: Prisma.ProductWhereInput = {
      isDeleted: false,
      isActive: true,
    };

    if (categoryId) {
      whereBase.categoryId = categoryId;
    }

    if (inStock !== undefined) {
      whereBase.stock = inStock ? { gt: 0 } : { lte: 0 };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      whereBase.price = {};
      if (minPrice !== undefined) whereBase.price.gte = minPrice;
      if (maxPrice !== undefined) whereBase.price.lte = maxPrice;
    }

    if (search) {
      const searchResult = await this.searchService.searchProducts(
        search,
        categoryId,
        page,
        limit,
      );

      if (searchResult) {
        if (!searchResult.ids.length) {
          return {
            data: [],
            meta: createPaginationMeta(0, page, limit),
          };
        }

        const products = await this.prisma.product.findMany({
          where: {
            id: { in: searchResult.ids },
            ...whereBase,
          },
          include: this.publicProductInclude,
        });

        const productsById = new Map(
          products.map((product) => [product.id, product]),
        );
        const ordered = searchResult.ids
          .map((id) => productsById.get(id))
          .filter((product): product is PublicProductWithCategory => !!product);

        const response = {
          data: ordered.map((p) => this.toPublicResponse(p)),
          meta: createPaginationMeta(searchResult.total, page, limit),
        };
        await this.cacheService.set(cacheKey, response, PRODUCT_TTL);
        return response;
      }
    }

    const where: Prisma.ProductWhereInput = {
      ...whereBase,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: this.publicProductInclude,
        orderBy: { createdAt: 'desc' },
        ...getPagination(page, limit),
      }),
    ]);

    const response = {
      data: products.map((p) => this.toPublicResponse(p)),
      meta: createPaginationMeta(total, page, limit),
    };
    await this.cacheService.set(cacheKey, response, PRODUCT_TTL);
    return response;
  }

  /** Public single — active product by slug. */
  async findOnePublic(
    slug: string,
    bypassCache?: boolean,
  ): Promise<PublicProductResponseDto> {
    const cacheKey = PRODUCT_BY_SLUG(slug);

    if (!bypassCache) {
      const cached =
        await this.cacheService.get<PublicProductResponseDto>(cacheKey);
      if (cached) return cached;
    }

    const product = await this.prisma.product.findFirst({
      where: { slug, isDeleted: false, isActive: true },
      include: this.publicProductInclude,
    });
    if (!product) throw new NotFoundException('Product not found');

    const response = this.toPublicResponse(product);
    await this.cacheService.set(cacheKey, response, PRODUCT_TTL);
    return response;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // READ — Creator context (own products, all statuses, no creator object)
  // ═════════════════════════════════════════════════════════════════════════

  /** Creator listing — all of the authenticated creator's products (any active/deleted state). */
  async findAllForCreator(
    creatorId: string,
    query: QueryProductDto,
  ): Promise<{
    data: CreatorProductResponseDto[];
    meta: ReturnType<typeof createPaginationMeta>;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      categoryPath,
      categoryId: categoryIdQuery,
      inStock,
      minPrice,
      maxPrice,
      isDeleted,
      isActive,
    } = query;

    let categoryId: string | undefined;
    if (categoryIdQuery) {
      categoryId = categoryIdQuery;
    } else if (categoryPath) {
      categoryId = await resolveCategoryIdFromPath(this.prisma, categoryPath);
    }

    const where: Prisma.ProductWhereInput = { creatorId };

    if (isDeleted !== undefined) {
      where.isDeleted = isDeleted;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (inStock !== undefined) {
      where.stock = inStock ? { gt: 0 } : { lte: 0 };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: this.creatorProductInclude,
        orderBy: { createdAt: 'desc' },
        ...getPagination(page, limit),
      }),
    ]);

    return {
      data: products.map((p) => this.toCreatorResponse(p)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  /** Creator single — own product by slug; throws ForbiddenException if it belongs to another creator. */
  async findOneForCreator(
    slug: string,
    creatorId: string,
  ): Promise<CreatorProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, isDeleted: false },
      include: this.creatorProductInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.creatorId !== creatorId) {
      throw new ForbiddenException(
        'You do not have permission to access this product',
      );
    }
    return this.toCreatorResponse(product);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // READ — Admin context (all products regardless of status, full creator)
  // ═════════════════════════════════════════════════════════════════════════

  /** Admin listing — paginated; supports all query filters including isDeleted & isActive. */
  async findAllForAdmin(query: QueryProductDto): Promise<{
    data: AdminProductResponseDto[];
    meta: ReturnType<typeof createPaginationMeta>;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      categoryPath,
      categoryId: categoryIdQuery,
      inStock,
      minPrice,
      maxPrice,
      isDeleted,
      isActive,
    } = query;

    let categoryId: string | undefined;
    if (categoryIdQuery) {
      categoryId = categoryIdQuery;
    } else if (categoryPath) {
      categoryId = await resolveCategoryIdFromPath(this.prisma, categoryPath);
    }

    const where: Prisma.ProductWhereInput = {};

    if (isDeleted !== undefined) {
      where.isDeleted = isDeleted;
    } else {
      where.isDeleted = false;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (inStock !== undefined) {
      where.stock = inStock ? { gt: 0 } : { lte: 0 };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: this.adminListInclude,
        orderBy: { createdAt: 'desc' },
        ...getPagination(page, limit),
      }),
    ]);

    return {
      data: products.map((p) => this.toAdminResponse(p)),
      meta: createPaginationMeta(total, page, limit),
    };
  }

  /** Admin single — any product by ID including soft-deleted and inactive. */
  async findOneForAdmin(id: string): Promise<AdminProductResponseDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.toAdminResponse(product);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MUTATIONS (admin)
  // ═════════════════════════════════════════════════════════════════════════

  async updateStock(
    id: string,
    quantity: number,
    userId?: string,
    description?: string,
  ): Promise<StockUpdateResponseDto> {
    const product = await this.findActiveProductOrThrow(id);

    if (product.hasVariants) {
      throw new BadRequestException(
        'Stock is managed at the variant level for variant products. Use the variant stock endpoint instead.',
      );
    }

    const newStock = product.stock + quantity;

    if (newStock < 0) {
      throw new BadRequestException(
        `Insufficient stock: cannot apply ${quantity} to current level of ${product.stock}`,
      );
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
      select: {
        id: true,
        slug: true,
        stock: true,
        updatedAt: true,
      },
    });

    await this.prisma.stockHistory.create({
      data: {
        productId: id,
        adjustment: quantity,
        oldStockQuantity: product.stock,
        newStockQuantity: newStock,
        description:
          description ??
          (quantity >= 0
            ? 'Manual stock adjustment'
            : 'Manual stock reduction'),
      },
    });

    const { inStock, stockStatus } = getStockStatus(newStock, true);
    const response: StockUpdateResponseDto = {
      id: updated.id,
      slug: updated.slug,
      stock: updated.stock,
      inStock,
      stockStatus,
      updatedAt: updated.updatedAt,
    };

    await this.cacheService.del(PRODUCT_BY_SLUG(updated.slug));

    await this.auditLog.log({
      action: 'UPDATE_PRODUCT_STOCK',
      entity: 'Product',
      entityId: id,
      adminId: userId,
      userId,
      payload: {
        previousStock: product.stock,
        newStock,
        adjustment: quantity,
      },
    });

    return response;
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    userId?: string,
  ): Promise<AdminProductResponseDto> {
    const existing = await this.findActiveProductOrThrow(id);

    const { slug: slugInput, name, imageUrl, ...rest } = dto;
    const data: Prisma.ProductUpdateInput = { ...rest };

    // If hasVariants is being set to true, force stock to 0
    if (dto.hasVariants === true && !existing.hasVariants) {
      data.stock = 0;
    }

    if (name !== undefined) data.name = name;

    if (slugInput?.trim()) {
      data.slug = await this.resolveProductSlug(
        name ?? existing.name,
        existing.categoryId,
        slugInput,
        id,
      );
    } else if (name !== undefined) {
      data.slug = await this.resolveProductSlug(
        name,
        existing.categoryId,
        undefined,
        id,
      );
    }

    if (imageUrl !== undefined) {
      data.images = {
        updateMany: {
          where: { isPrimary: true },
          data: { isPrimary: false },
        },
        create: { url: imageUrl, isPrimary: true },
      };
    }

    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data,
        include: this.productInclude,
      });
      const response = this.toAdminResponse(updated);
      await this.cacheService.del(PRODUCT_BY_SLUG(updated.slug));
      await this.cacheService.delByPattern('products:public:*');
      await this.cacheService.delByPattern(
        `creator:store:${updated.creator.storeSlug}:products`,
      );

      await this.auditLog.log({
        action: 'UPDATE_PRODUCT',
        entity: 'Product',
        entityId: id,
        adminId: userId,
        userId,
        payload: {
          changes: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
        },
      });

      return response;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async deactivate(id: string, userId?: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id, isDeleted: false },
    });
    if (!product) throw new NotFoundException('Product not found');
    const creator = await this.prisma.creator.findUnique({
      where: { id: product.creatorId },
      select: { storeSlug: true },
    });
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    await this.cacheService.del(PRODUCT_BY_SLUG(product.slug));
    await this.cacheService.delByPattern('products:public:*');
    if (creator) {
      await this.cacheService.delByPattern(
        `creator:store:${creator.storeSlug}:products`,
      );
    }

    await this.auditLog.log({
      action: 'DEACTIVATE_PRODUCT',
      entity: 'Product',
      entityId: id,
      adminId: userId,
      userId,
      payload: { name: product.name, sku: product.sku },
    });
  }

  async reactivate(
    id: string,
    userId?: string,
  ): Promise<ProductReactivateResponseDto> {
    const product = await this.prisma.product.findFirst({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        slug: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await this.cacheService.del(PRODUCT_BY_SLUG(updated.slug));
    await this.cacheService.delByPattern('products:public:*');

    await this.auditLog.log({
      action: 'REACTIVATE_PRODUCT',
      entity: 'Product',
      entityId: id,
      adminId: userId,
      userId,
      payload: { name: product.name, sku: product.sku },
    });

    return updated;
  }

  async permanentRemove(id: string, userId?: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    await this.prisma.product.delete({ where: { id } });
    await this.cacheService.del(PRODUCT_BY_SLUG(product.slug));
    await this.cacheService.delByPattern('products:public:*');

    await this.auditLog.log({
      action: 'PERMANENT_DELETE_PRODUCT',
      entity: 'Product',
      entityId: id,
      adminId: userId,
      userId,
      payload: { name: product.name, sku: product.sku },
    });
  }

  async restore(id: string, userId?: string): Promise<ProductResponseDto> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Product not found');
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isDeleted: false, isActive: true },
      include: this.productInclude,
    });
    const response = this.toResponse(updated);
    await this.cacheService.del(PRODUCT_BY_SLUG(updated.slug));
    await this.cacheService.delByPattern('products:public:*');

    await this.auditLog.log({
      action: 'RESTORE_PRODUCT',
      entity: 'Product',
      entityId: id,
      adminId: userId,
      userId,
      payload: { name: existing.name, sku: existing.sku },
    });

    return response;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // LEGACY READ METHODS (still used by other parts of the system)
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Retrieves a product by ID for public consumption (active, not deleted).
   * Returns the full ProductResponseDto for backward compatibility.
   */
  async findOne(id: string): Promise<ProductResponseDto> {
    const cacheKey = `product:id:${id}`;
    const cached = await this.cacheService.get<ProductResponseDto>(cacheKey);
    if (cached) return cached;

    const product = await this.prisma.product.findFirst({
      where: { id, isDeleted: false, isActive: true },
      include: this.productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');

    const response = this.toResponse(product);
    await this.cacheService.set(cacheKey, response, PRODUCT_TTL);
    await this.cacheService.set(
      `product:slug:${product.slug}`,
      response,
      PRODUCT_TTL,
    );
    return response;
  }

  /**
   * @deprecated Use findOnePublic(slug) instead.
   * Kept for backward compatibility.
   */
  async findBySlug(slug: string) {
    return this.findOnePublic(slug);
  }

  /**
   * @deprecated Use findOneForCreator(slug, creatorId) instead.
   * Kept for backward compatibility.
   */
  async findBySlugForCreator(
    creatorId: string,
    slug: string,
  ): Promise<ProductResponseDto> {
    return this.findOneForCreator(
      slug,
      creatorId,
    ) as unknown as Promise<ProductResponseDto>;
  }

  /**
   * @deprecated Use findAllForAdmin(query) instead.
   * Kept for backward compatibility.
   */
  async findAll(query: QueryProductDto): Promise<{
    data: AdminProductResponseDto[];
    meta: ReturnType<typeof createPaginationMeta>;
  }> {
    return this.findAllForAdmin(query);
  }

  /**
   * @deprecated Use findAllForCreator(creatorId, query) instead.
   * Kept for backward compatibility.
   */
  async findAllByCreator(
    creatorId: string,
    query: QueryProductDto,
  ): Promise<{
    data: CreatorProductResponseDto[];
    meta: ReturnType<typeof createPaginationMeta>;
  }> {
    return this.findAllForCreator(creatorId, query);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  private async findActiveProductOrThrow(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isDeleted: false },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  // ── Response mappers ──────────────────────────────────────────────────────

  /** Computes total stock based on whether the product uses variants. */
  private computeTotalStock(
    hasVariants: boolean,
    stock: number,
    variants: { stock: number }[],
  ): number {
    if (!hasVariants) return stock;
    return variants.reduce((sum, v) => sum + v.stock, 0);
  }

  /** Maps full product (with full creator) → ProductResponseDto. */
  private toResponse(product: ProductWithCategory): ProductResponseDto {
    const totalStock = this.computeTotalStock(
      product.hasVariants,
      product.stock,
      product.variants,
    );
    const { inStock, stockStatus } = getStockStatus(
      totalStock,
      product.isActive && !product.isDeleted,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      sku: product.sku,
      hasVariants: product.hasVariants,
      price: Number(product.price),
      stock: totalStock,
      inStock,
      stockStatus,
      variants: product.variants.map((variant) =>
        this.toVariantSummaryDto(variant),
      ),
      variantCombinations:
        product.variants.length > 0
          ? computeVariantCombinations(product.variants)
          : undefined,
      creator: {
        id: product.creator.id,
        storeName: product.creator.storeName,
        storeSlug: product.creator.storeSlug,
        storeLogoUrl: product.creator.storeLogoUrl,
      },
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      imageUrl: product.images?.[0]?.url ?? null,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /** Maps public product (trimmed creator) → PublicProductResponseDto. */
  private toPublicResponse(
    product: PublicProductWithCategory,
  ): PublicProductResponseDto {
    const totalStock = this.computeTotalStock(
      product.hasVariants,
      product.stock,
      product.variants,
    );
    const { inStock, stockStatus } = getStockStatus(
      totalStock,
      product.isActive && !product.isDeleted,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      sku: product.sku,
      hasVariants: product.hasVariants,
      price: Number(product.price),
      stock: totalStock,
      discountPrice: undefined,
      inStock,
      stockStatus,
      variants: product.variants.map((variant) =>
        this.toVariantSummaryDto(variant),
      ),
      variantCombinations:
        product.variants.length > 0
          ? computeVariantCombinations(product.variants)
          : undefined,
      creator: {
        id: product.creator.id,
        storeName: product.creator.storeName,
        storeSlug: product.creator.storeSlug,
        storeLogoUrl: product.creator.storeLogoUrl,
      },
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      imageUrl: product.images?.[0]?.url ?? null,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /** Maps creator-scoped product (no creator) → CreatorProductResponseDto. */
  private toCreatorResponse(
    product: CreatorProductWithCategory,
  ): CreatorProductResponseDto {
    const totalStock = this.computeTotalStock(
      product.hasVariants,
      product.stock,
      product.variants,
    );
    const { inStock, stockStatus } = getStockStatus(
      totalStock,
      product.isActive && !product.isDeleted,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      sku: product.sku,
      hasVariants: product.hasVariants,
      price: Number(product.price),
      stock: totalStock,
      inStock,
      stockStatus,
      variants: product.variants.map((variant) =>
        this.toVariantSummaryDto(variant),
      ),
      variantCombinations:
        product.variants.length > 0
          ? computeVariantCombinations(product.variants)
          : undefined,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      images: (product.images ?? []).map((img) => ({
        id: img.id,
        url: img.url,
        position: img.position,
      })),
      isActive: product.isActive,
      isDeleted: product.isDeleted,
      deletedAt: product.deletedAt ?? null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /** Maps full product (with full creator) → AdminProductResponseDto. */
  private toAdminResponse(
    product: ProductWithCategory,
  ): AdminProductResponseDto {
    const totalStock = this.computeTotalStock(
      product.hasVariants,
      product.stock,
      product.variants,
    );
    const { inStock, stockStatus } = getStockStatus(
      totalStock,
      product.isActive && !product.isDeleted,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      sku: product.sku,
      hasVariants: product.hasVariants,
      price: Number(product.price),
      stock: totalStock,
      inStock,
      stockStatus,
      variants: product.variants.map((variant) =>
        this.toVariantSummaryDto(variant),
      ),
      variantCombinations:
        product.variants.length > 0
          ? computeVariantCombinations(product.variants)
          : undefined,
      creator: {
        id: product.creator.id,
        storeName: product.creator.storeName,
        storeSlug: product.creator.storeSlug,
        storeLogoUrl: product.creator.storeLogoUrl,
      },
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      images: (product.images ?? []).map((img) => ({
        id: img.id,
        url: img.url,
        position: img.position,
      })),
      isActive: product.isActive,
      isDeleted: product.isDeleted,
      deletedAt: product.deletedAt ?? null,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private toVariantSummaryDto(variant: {
    id: string;
    options: Prisma.JsonValue;
    stock: number;
    images: string[];
    isActive: boolean;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }): VariantSummaryDto {
    const options = normalizeOptions(variant.options).map(
      ({ name, value }) => ({
        name,
        value,
      }),
    );
    const { inStock, stockStatus } = getStockStatus(
      variant.stock,
      variant.isActive && !variant.isDeleted,
    );

    return {
      id: variant.id,
      options,
      stock: variant.stock,
      inStock,
      stockStatus,
      images: variant.images ?? [],
      isActive: variant.isActive,
      isDeleted: variant.isDeleted,
      createdAt: variant.createdAt ?? new Date(),
      updatedAt: variant.updatedAt ?? new Date(),
    };
  }

  // ── Slug helpers ──────────────────────────────────────────────────────────

  /** Normalize slug from name or explicit value; unique within the category. */
  private async resolveProductSlug(
    name: string,
    categoryId: string,
    explicitSlug?: string,
    excludeProductId?: string,
  ): Promise<string> {
    const base = explicitSlug?.trim()
      ? generateSlug(explicitSlug)
      : generateSlug(name);

    if (!base) {
      throw new BadRequestException(
        'Could not generate a slug; provide a slug or a name with letters or numbers',
      );
    }

    return this.ensureUniqueProductSlug(base, categoryId, excludeProductId);
  }

  private async ensureUniqueProductSlug(
    base: string,
    categoryId: string,
    excludeProductId?: string,
  ): Promise<string> {
    let candidate = base;
    let suffix = 2;

    while (true) {
      const existing = await this.prisma.product.findFirst({
        where: {
          categoryId,
          slug: candidate,
          ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
  }

  private async resolveCategoryId(dto: CreateProductDto): Promise<string> {
    if (!dto.categoryId) {
      throw new BadRequestException(
        'categoryId is required for product creation',
      );
    }

    await this.assertCategoryIsLeaf(dto.categoryId);
    return dto.categoryId;
  }

  private async assertCategoryIsLeaf(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('Invalid categoryId');
    }

    // Check if this category has any children
    const childrenCount = await this.prisma.category.count({
      where: {
        parentId: categoryId,
        isActive: true,
      },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        'Products can only be created under a leaf category',
      );
    }
  }


  private async clearProductCache(slug: string, id?: string): Promise<void> {
    const keys = [`product:slug:${slug}`];
    if (id) {
      keys.push(`product:id:${id}`);
    }
    await this.cacheService.invalidateMany(keys);
    await this.cacheService.invalidateByPattern('product:list:*');
  }
}
