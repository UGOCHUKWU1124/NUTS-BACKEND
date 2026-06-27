import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CacheService } from 'src/modules/infrastructure/cache/cache.service';
import {
  CATEGORY_TREE,
  CATEGORY_BY_SLUG,
  CATEGORY_TTL,
} from 'src/modules/shared/constants/cache.constant';
import { Category, Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { generateSlug } from 'src/modules/shared/utils/slug.util';
import { mapPrismaError } from 'src/modules/shared/utils/prisma-error.util';
import {
  CATEGORY_DEPTH,
  CategoryType,
  DEPTH_TO_TYPE,
} from './constants/category.constants';
import { resolveCategoryIdFromPath } from 'src/modules/shared/utils/category-path.util';
import { getStockStatus } from 'src/modules/shared/utils/stock-status.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { ParentsubcategoryResponseDto } from './dto/parentsubcategory-response.dto';
import { SubcategoryResponseDto } from './dto/subcategory-response.dto';
import { ProductResponseDto } from '../products/dto/product-response.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    let depth: number;
    const parentId: string | null = dto.parentId ?? null;

    if (!parentId) {
      depth = CATEGORY_DEPTH.CATEGORY;
    } else {
      const parent = await this.prisma.category.findUnique({
        where: { id: parentId },
        select: { depth: true, type: true },
      });

      if (!parent) {
        throw new BadRequestException('Parent category not found');
      }

      if (parent.type === CategoryType.Subcategory) {
        throw new BadRequestException(
          'Maximum depth reached. Cannot create a child under a Subcategory.',
        );
      }

      depth = parent.depth + 1;
      if (depth > CATEGORY_DEPTH.SUBCATEGORY) {
        throw new BadRequestException(
          'Maximum depth reached. Cannot create a child under a Subcategory.',
        );
      }
    }

    const type = DEPTH_TO_TYPE[depth];
    const slug = await this.resolveSlug(
      dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name),
    );

    try {
      const category = await this.prisma.category.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description ?? null,
          imageUrl: dto.imageUrl ?? null,
          parentId,
          depth,
          type,
        },
      });

      const response = this.toCategoryResponse(category, []);
      await this.cacheService.del(CATEGORY_TREE());
      return response;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  // ─────────────────────────────────────────────
  // GET TREE (admin — includes inactive nodes)
  // ─────────────────────────────────────────────

  async getAdminTree(): Promise<CategoryResponseDto[]> {
    const all = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    const roots = all.filter(
      (c) => c.parentId === null && c.type === CategoryType.Category,
    );
    return roots.map((root) => this.toCategoryResponse(root, all));
  }

  // ─────────────────────────────────────────────
  // FIND BY SLUG (admin — includes inactive nodes)
  // ─────────────────────────────────────────────

  async findBySlugAdmin(
    slug: string,
  ): Promise<
    CategoryResponseDto | ParentsubcategoryResponseDto | SubcategoryResponseDto
  > {
    const category = await this.prisma.category.findUnique({ where: { slug } });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.type === CategoryType.Subcategory) {
      return this.toSubcategory(category);
    }

    // Load all descendants (active and inactive) for full nested response
    const children = await this.prisma.category.findMany({
      where: { parentId: category.id },
      orderBy: { name: 'asc' },
    });

    if (category.type === CategoryType.Parentsubcategory) {
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        type: CategoryType.Parentsubcategory,
        depth: category.depth,
        isActive: category.isActive,
        parentId: category.parentId,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        subCategory: children
          .filter((c) => c.type === CategoryType.Subcategory)
          .map((c) => this.toSubcategory(c)),
      };
    }

    // Category — need grandchildren too
    const grandchildren = children.length
      ? await this.prisma.category.findMany({
          where: { parentId: { in: children.map((c) => c.id) } },
          orderBy: { name: 'asc' },
        })
      : [];

    return this.toCategoryResponse(category, [...children, ...grandchildren]);
  }

  // ─────────────────────────────────────────────
  // GET TREE
  // ─────────────────────────────────────────────

  async getTree(bypassCache?: boolean): Promise<CategoryResponseDto[]> {
    const fetch = async () => {
      const all = await this.prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });

      const roots = all.filter(
        (c) => c.parentId === null && c.type === CategoryType.Category,
      );
      return roots.map((root) => this.toCategoryResponse(root, all));
    };

    if (bypassCache) {
      return fetch();
    }

    return this.cacheService.wrap(CATEGORY_TREE(), CATEGORY_TTL, fetch);
  }

  // ─────────────────────────────────────────────
  // FIND BY SLUG
  // ─────────────────────────────────────────────

  async findBySlug(
    slug: string,
  ): Promise<
    CategoryResponseDto | ParentsubcategoryResponseDto | SubcategoryResponseDto
  > {
    return this.cacheService.wrap(
      CATEGORY_BY_SLUG(slug),
      CATEGORY_TTL,
      async () => {
        const category = await this.prisma.category.findUnique({
          where: { slug },
        });

        if (!category) {
          throw new NotFoundException('Category not found');
        }

        return this.toTypedResponse(category);
      },
    );
  }

  // ─────────────────────────────────────────────
  // FIND BY PATH — resolves to a category or a product
  // e.g. "fashion/womenswear" → category
  // e.g. "fashion/womenswear/bubus-and-dresses/yellow-bubu-gown" → product
  // ─────────────────────────────────────────────

  async findByPath(
    path: string,
  ): Promise<
    | CategoryResponseDto
    | ParentsubcategoryResponseDto
    | SubcategoryResponseDto
    | ProductResponseDto
  > {
    const normalized = path.replace(/,/g, '/');

    // ── Try as a category path first ──
    try {
      const id = await resolveCategoryIdFromPath(this.prisma, normalized);
      const category = await this.prisma.category.findUnique({
        where: { id },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
      return this.toTypedResponse(category);
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
    }

    // ── Not a full category path — try last segment as product slug ──
    const slugs = normalized.split('/').filter(Boolean);
    if (slugs.length < 2) {
      throw new NotFoundException('Resource not found');
    }

    const productSlug = slugs.pop()!;
    const parentPath = slugs.join('/');

    const categoryId = await resolveCategoryIdFromPath(this.prisma, parentPath);

    // Collect all descendant IDs (product may be in any subcategory under this node)
    const descendantIds = await this.collectDescendantIds(categoryId);
    const allIds = [...descendantIds, categoryId];

    const product = await this.prisma.product.findFirst({
      where: {
        slug: productSlug,
        categoryId: { in: allIds },
        isActive: true,
        isDeleted: false,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, take: 1 },
        creator: {
          select: {
            id: true,
            email: true,
            storeName: true,
            storeSlug: true,
            storeDescription: true,
            businessPhone: true,
            businessEmail: true,
            storeLogoUrl: true,
            storeLogoAltText: true,
            firstName: true,
            lastName: true,
            phone: true,
            isVerified: true,
            isActive: true,
            isApproved: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        variants: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            options: true,
            stock: true,
            isActive: true,
            isDeleted: true,
            deletedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Resource not found');
    }

    const effectiveStock = product.hasVariants
      ? product.variants.reduce((sum, v) => sum + v.stock, 0)
      : product.stock;
    const { inStock, stockStatus } = getStockStatus(
      effectiveStock,
      product.isActive && !product.isDeleted,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: Number(product.price),
      stock: effectiveStock,
      inStock,
      stockStatus,
      sku: product.sku,
      variants: product.variants.map((v) => {
        const options = Array.isArray(v.options)
          ? (v.options as Array<{ name: string; value: string }>).map(
              ({ name, value }) => ({ name, value }),
            )
          : Object.entries(v.options as Record<string, string>).map(
              ([name, value]) => ({ name, value }),
            );
        const { inStock: vInStock, stockStatus: vStockStatus } = getStockStatus(
          v.stock,
          v.isActive && !v.isDeleted,
        );

        return {
          id: v.id,
          options,
          stock: v.stock,
          inStock: vInStock,
          stockStatus: vStockStatus,
          isActive: v.isActive,
          isDeleted: v.isDeleted,
          deletedAt: v.deletedAt ?? undefined,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
        };
      }),
      creator: {
        id: product.creator.id,
        email: product.creator.email,
        storeName: product.creator.storeName,
        storeSlug: product.creator.storeSlug,
        storeDescription: product.creator.storeDescription,
        businessPhone: product.creator.businessPhone,
        businessEmail: product.creator.businessEmail,
        storeLogoUrl: product.creator.storeLogoUrl,
        storeLogoAltText: product.creator.storeLogoAltText,
        firstName: product.creator.firstName,
        lastName: product.creator.lastName,
        phone: product.creator.phone,
        isVerified: product.creator.isVerified,
        isActive: product.creator.isActive,
        isApproved: product.creator.isApproved,
        createdAt: product.creator.createdAt,
        updatedAt: product.creator.updatedAt,
      },
      subcategory: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
      imageUrl: product.images?.[0]?.url ?? null,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    } as unknown as ProductResponseDto;
  }

  // ─────────────────────────────────────────────
  // SET ACTIVE / INACTIVE (cascading BFS)
  // ─────────────────────────────────────────────

  async setActive(slug: string, active: boolean): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const id = category.id;

    // BFS to collect all descendant IDs
    const allIds = await this.collectDescendantIds(id);
    allIds.push(id);

    await this.prisma.category.updateMany({
      where: { id: { in: allIds } },
      data: { isActive: active },
    });

    await this.cacheService.del(CATEGORY_TREE());
  }

  // ─────────────────────────────────────────────
  // REMOVE (hard delete — only if leaf with no products)
  // ─────────────────────────────────────────────

  async remove(slug: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: { select: { children: true, products: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const id = category.id;

    if (category._count.children > 0) {
      throw new BadRequestException(
        'Cannot delete a category that has child categories',
      );
    }

    if (category._count.products > 0) {
      throw new BadRequestException(
        'Cannot delete a category that has products assigned to it',
      );
    }

    await this.prisma.category.delete({ where: { id } });

    await this.cacheService.del(CATEGORY_TREE());
    await this.cacheService.del(CATEGORY_BY_SLUG(slug));
  }

  // ─────────────────────────────────────────────
  // UPDATE (no parentId allowed)
  // ─────────────────────────────────────────────

  async update(
    slug: string,
    dto: UpdateCategoryDto,
  ): Promise<
    CategoryResponseDto | ParentsubcategoryResponseDto | SubcategoryResponseDto
  > {
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const id = existing.id;

    const data: Prisma.CategoryUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.slug !== undefined) {
      data.slug = await this.resolveSlug(generateSlug(dto.slug), id);
    } else if (dto.name !== undefined && existing.slug) {
      // If name changed and slug was auto-generated, let it be - keep existing slug
    }

    if (dto.description !== undefined) {
      data.description = dto.description ?? null;
    }

    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl ?? null;
    }

    try {
      const updated = await this.prisma.category.update({
        where: { id },
        data,
      });

      await this.cacheService.del(CATEGORY_TREE());
      await this.cacheService.del(CATEGORY_BY_SLUG(slug));

      return this.toTypedResponse(updated);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  // ─────────────────────────────────────────────
  // ASSERT LEAF SUBCATEGORY (for ProductsService)
  // ─────────────────────────────────────────────

  async assertLeafSubcategory(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.type !== CategoryType.Subcategory) {
      throw new BadRequestException(
        'Products can only be assigned to a Subcategory (leaf) node',
      );
    }

    if (!category.isActive) {
      throw new BadRequestException(
        'Cannot assign a product to an inactive category',
      );
    }
  }

  // ─────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────

  private toSubcategory(category: Category): SubcategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      type: CategoryType.Subcategory,
      depth: category.depth,
      isActive: category.isActive,
      parentId: category.parentId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  private toParentsubcategory(
    category: Category,
    all: readonly Category[],
  ): ParentsubcategoryResponseDto {
    const children = all.filter(
      (c) => c.parentId === category.id && c.type === CategoryType.Subcategory,
    );
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      type: CategoryType.Parentsubcategory,
      depth: category.depth,
      isActive: category.isActive,
      parentId: category.parentId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      subCategory: children.map((c) => this.toSubcategory(c)),
    };
  }

  private toCategoryResponse(
    category: Category,
    all: readonly Category[],
  ): CategoryResponseDto {
    const children = all.filter(
      (c) =>
        c.parentId === category.id && c.type === CategoryType.Parentsubcategory,
    );
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      type: CategoryType.Category,
      depth: category.depth,
      isActive: category.isActive,
      parentId: category.parentId,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      parentSubCategory: children.map((child) =>
        this.toParentsubcategory(child, all),
      ),
    };
  }

  private async toTypedResponse(
    category: Category,
  ): Promise<
    CategoryResponseDto | ParentsubcategoryResponseDto | SubcategoryResponseDto
  > {
    if (category.type === CategoryType.Subcategory) {
      return this.toSubcategory(category);
    }

    // For non-leaf nodes, load children to build nested response
    // We need children based on type
    const children = await this.prisma.category.findMany({
      where: { parentId: category.id, isActive: true },
    });

    if (category.type === CategoryType.Parentsubcategory) {
      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        type: CategoryType.Parentsubcategory,
        depth: category.depth,
        isActive: category.isActive,
        parentId: category.parentId,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
        subCategory: children
          .filter((c) => c.type === CategoryType.Subcategory)
          .map((c) => this.toSubcategory(c)),
      };
    }

    // Category type — need to load grandchildren too for full nested response
    const grandchildren = children.length
      ? await this.prisma.category.findMany({
          where: {
            parentId: { in: children.map((c) => c.id) },
            isActive: true,
          },
        })
      : [];

    const allNodes = [...children, ...grandchildren];
    return this.toCategoryResponse(category, allNodes);
  }

  private async resolveSlug(
    candidate: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = candidate;
    let suffix = 0;

    const where: Prisma.CategoryWhereInput = { slug };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    while (
      await this.prisma.category.findFirst({ where, select: { id: true } })
    ) {
      suffix++;
      slug = `${candidate}-${suffix}`;
      where.slug = slug;
    }

    return slug;
  }

  private async collectDescendantIds(id: string): Promise<string[]> {
    const ids: string[] = [];
    const queue = [id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.prisma.category.findMany({
        where: { parentId: currentId },
        select: { id: true },
      });

      for (const child of children) {
        ids.push(child.id);
        queue.push(child.id);
      }
    }

    return ids;
  }
}
