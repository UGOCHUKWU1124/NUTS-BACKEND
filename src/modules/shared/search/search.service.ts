import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';

export type SearchIndex =
  | 'products'
  | 'creators'
  | 'categories'
  | 'users'
  | 'orders'
  | 'discount_codes';

export interface SearchResultItem {
  id: string;
  index: SearchIndex;
  type: string;
  title: string;
  subtitle?: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface SearchResponsePayload {
  results: SearchResultItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SearchProductHit {
  type: string;
  title: string;
  description: string | null;
  image: string | null;
  searchKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  price: number;
  creator: {
    slug: string;
    logo: string | null;
    banner: string | null;
    businessName: string;
  };
  category: {
    id: string;
    slug: string;
    name: string;
  };
  subcategory: {
    id: string;
    slug: string;
    name: string;
  } | null;
  section: string | null;
  hasDiscount: boolean;
  discountDetails: any;
  objectID: string;
}

export interface SearchProductsResponsePayload {
  hits: SearchProductHit[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly cacheTtlSeconds = 900;

  constructor(
    private readonly config: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) { }

  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
      this.logger.log('pg_trgm extension initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize pg_trgm extension', error);
    }
  }

  async searchProducts(
    search: string,
    categoryId?: string,
    page = 1,
    limit = 10,
  ): Promise<{ ids: string[]; total: number } | null> {
    if (!search) {
      return null;
    }

    const cacheKey = `search:products:ids:${categoryId ?? ''}:${search}:${page}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as { ids: string[]; total: number };
    }

    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;
    const offset = (page - 1) * limit;

    let products: any[];
    if (categoryId) {
      products = await this.prisma.$queryRaw<any[]>`
        SELECT id,
          (CASE 
            WHEN name ILIKE ${ilikeSearch} THEN 2.0 + similarity(name, ${search})
            WHEN sku ILIKE ${ilikeSearch} THEN 1.5 + similarity(sku, ${search})
            ELSE similarity(name, ${search})
          END) as score,
          COUNT(*) OVER()::integer as total_count
        FROM products
        WHERE "isActive" = true AND "isDeleted" = false AND "categoryId" = ${categoryId} AND (
          name ILIKE ${ilikeSearch}
          OR sku ILIKE ${ilikeSearch}
          OR similarity(name, ${search}) > ${similarityThreshold}
          OR similarity(sku, ${search}) > ${similarityThreshold}
        )
        ORDER BY score DESC, "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
    } else {
      products = await this.prisma.$queryRaw<any[]>`
        SELECT id,
          (CASE 
            WHEN name ILIKE ${ilikeSearch} THEN 2.0 + similarity(name, ${search})
            WHEN sku ILIKE ${ilikeSearch} THEN 1.5 + similarity(sku, ${search})
            ELSE similarity(name, ${search})
          END) as score,
          COUNT(*) OVER()::integer as total_count
        FROM products
        WHERE "isActive" = true AND "isDeleted" = false AND (
          name ILIKE ${ilikeSearch}
          OR sku ILIKE ${ilikeSearch}
          OR similarity(name, ${search}) > ${similarityThreshold}
          OR similarity(sku, ${search}) > ${similarityThreshold}
        )
        ORDER BY score DESC, "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
    }

    const total = products.length > 0 ? products[0].total_count : 0;
    const result = { ids: products.map((product) => product.id), total };
    await this.redis.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      this.cacheTtlSeconds,
    );
    return result;
  }

  async searchProductsWithDetails(
    search: string,
    page = 1,
    limit = 10,
  ): Promise<SearchProductsResponsePayload | null> {
    if (!search) {
      return null;
    }

    const cacheKey = `search:products:details:${encodeURIComponent(
      search,
    )}:${page}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SearchProductsResponsePayload;
    }

    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;
    const offset = (page - 1) * limit;

    const matchedProducts = await this.prisma.$queryRaw<any[]>`
      SELECT id,
        (CASE 
          WHEN name ILIKE ${ilikeSearch} THEN 2.0 + similarity(name, ${search})
          WHEN sku ILIKE ${ilikeSearch} THEN 1.5 + similarity(sku, ${search})
          WHEN description ILIKE ${ilikeSearch} THEN 1.0 + similarity(COALESCE(description, ''), ${search})
          ELSE similarity(name, ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM products
      WHERE "isActive" = true AND "isDeleted" = false AND (
        name ILIKE ${ilikeSearch}
        OR sku ILIKE ${ilikeSearch}
        OR COALESCE(description, '') ILIKE ${ilikeSearch}
        OR similarity(name, ${search}) > ${similarityThreshold}
        OR similarity(sku, ${search}) > ${similarityThreshold}
        OR similarity(COALESCE(description, ''), ${search}) > ${similarityThreshold}
      )
      ORDER BY score DESC, "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    if (matchedProducts.length === 0) {
      const response = {
        hits: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      };
      await this.redis.set(
        cacheKey,
        JSON.stringify(response),
        'EX',
        this.cacheTtlSeconds,
      );
      return response;
    }

    const total = matchedProducts[0].total_count;
    const ids = matchedProducts.map((p) => p.id);

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        creator: {
          select: {
            storeName: true,
            storeSlug: true,
            storeLogoUrl: true,
          },
        },
        images: { where: { isPrimary: true }, take: 1 },
      },
    });

    // Order products to match the score order
    const productMap = new Map(products.map((p) => [p.id, p]));
    const orderedProducts = ids
      .map((id) => productMap.get(id))
      .filter((p): p is typeof products[number] => !!p);

    const hits = orderedProducts.map((product) => ({
      type: 'product',
      title: product.name,
      description: product.description ?? null,
      image: product.images[0]?.url ?? null,
      searchKeywords: [
        product.name,
        product.category.name,
        product.creator.storeName,
      ].filter((value): value is string => Boolean(value)),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      slug: product.slug,
      price: Number(product.price),
      creator: {
        slug: product.creator.storeSlug,
        logo: product.creator.storeLogoUrl ?? null,
        banner: null,
        businessName: product.creator.storeName,
      },
      category: {
        id: product.category.id,
        slug: product.category.slug,
        name: product.category.name,
      },
      subcategory: null,
      section: null,
      hasDiscount: false,
      discountDetails: null,
      objectID: product.id,
    }));

    const response = {
      hits,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redis.set(
      cacheKey,
      JSON.stringify(response),
      'EX',
      this.cacheTtlSeconds,
    );

    return response;
  }

  async searchMarketplace(
    search: string,
    types?: SearchIndex[],
    page = 1,
    limit = 10,
  ): Promise<SearchResponsePayload | null> {
    if (!search) {
      return null;
    }

    const indexes: SearchIndex[] =
      types && types.length
        ? types.filter((type) =>
          ['products', 'creators', 'categories'].includes(type),
        )
        : ['products', 'creators', 'categories'];

    return this.executeSearch(indexes, search, page, limit);
  }

  async searchAdminGlobal(
    search: string,
    types?: SearchIndex[],
    page = 1,
    limit = 20,
  ): Promise<SearchResponsePayload | null> {
    if (!search) {
      return null;
    }

    const indexes: SearchIndex[] =
      types && types.length
        ? types.filter((type) =>
          [
            'users',
            'creators',
            'products',
            'orders',
            'discount_codes',
          ].includes(type),
        )
        : ['users', 'creators', 'products', 'orders', 'discount_codes'];

    return this.executeSearch(indexes, search, page, limit);
  }

  async autocomplete(
    search: string,
    types?: SearchIndex[],
    limit = 10,
  ): Promise<SearchResultItem[] | null> {
    if (!search) {
      return null;
    }

    const indexes: SearchIndex[] =
      types && types.length
        ? types.filter((type) =>
          ['products', 'creators', 'categories'].includes(type),
        )
        : ['products', 'creators', 'categories'];

    const cacheKey = `search:autocomplete:${indexes.sort().join(',')}:${search}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SearchResultItem[];
    }

    const result = await this.executeSearch(indexes, search, 1, limit);
    if (!result) {
      return null;
    }

    await this.redis.set(
      cacheKey,
      JSON.stringify(result.results),
      'EX',
      this.cacheTtlSeconds,
    );

    return result.results;
  }

  private async executeSearch(
    indexes: SearchIndex[],
    search: string,
    page: number,
    limit: number,
  ): Promise<SearchResponsePayload | null> {
    const cacheKey = `search:db:${indexes.sort().join(',')}:${search}:${page}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SearchResponsePayload;
    }

    const searchLimit = page * limit;
    const results = await Promise.all(
      indexes.map((index) => this.searchIndex(index, search, searchLimit)),
    );

    const total = results.reduce((sum, entry) => sum + entry.total, 0);
    const items = results
      .flatMap((entry) => entry.items)
      .slice((page - 1) * limit, page * limit);

    const response = {
      results: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redis.set(
      cacheKey,
      JSON.stringify(response),
      'EX',
      this.cacheTtlSeconds,
    );

    return response;
  }

  private async searchIndex(
    index: SearchIndex,
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    switch (index) {
      case 'products':
        return this.searchProductsDb(search, limit);
      case 'creators':
        return this.searchCreatorsDb(search, limit);
      case 'categories':
        return this.searchCategoriesDb(search, limit);
      case 'users':
        return this.searchUsersDb(search, limit);
      case 'orders':
        return this.searchOrdersDb(search, limit);
      case 'discount_codes':
        return this.searchDiscountCodesDb(search, limit);
      default:
        return { items: [], total: 0 };
    }
  }

  private async searchProductsDb(
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedProducts = await this.prisma.$queryRaw<any[]>`
      SELECT id, name, sku,
        (CASE 
          WHEN name ILIKE ${ilikeSearch} THEN 2.0 + similarity(name, ${search})
          WHEN sku ILIKE ${ilikeSearch} THEN 1.5 + similarity(sku, ${search})
          ELSE similarity(name, ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM products
      WHERE "isActive" = true AND "isDeleted" = false AND (
        name ILIKE ${ilikeSearch}
        OR sku ILIKE ${ilikeSearch}
        OR similarity(name, ${search}) > ${similarityThreshold}
        OR similarity(sku, ${search}) > ${similarityThreshold}
      )
      ORDER BY score DESC, "createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedProducts.length > 0 ? matchedProducts[0].total_count : 0;
    const items = matchedProducts.map((product) => ({
      id: product.id,
      index: 'products' as const,
      type: 'product',
      title: product.name,
      subtitle: product.sku,
      score: Number(product.score),
      payload: {
        id: product.id,
        name: product.name,
        sku: product.sku,
      },
    }));

    return { total, items };
  }

  private async searchCreatorsDb(
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedCreators = await this.prisma.$queryRaw<any[]>`
      SELECT id, "storeName", "storeDescription", email, "firstName", "lastName",
        (CASE 
          WHEN "storeName" ILIKE ${ilikeSearch} THEN 3.0 + similarity("storeName", ${search})
          WHEN "firstName" ILIKE ${ilikeSearch} OR "lastName" ILIKE ${ilikeSearch} THEN 2.0 + similarity(COALESCE("firstName", '') || ' ' || COALESCE("lastName", ''), ${search})
          WHEN "storeDescription" ILIKE ${ilikeSearch} THEN 1.0 + similarity(COALESCE("storeDescription", ''), ${search})
          ELSE similarity("storeName", ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM creators
      WHERE "isActive" = true AND "isApproved" = true AND (
        "storeName" ILIKE ${ilikeSearch}
        OR COALESCE("storeDescription", '') ILIKE ${ilikeSearch}
        OR email ILIKE ${ilikeSearch}
        OR "firstName" ILIKE ${ilikeSearch}
        OR "lastName" ILIKE ${ilikeSearch}
        OR similarity("storeName", ${search}) > ${similarityThreshold}
        OR similarity(COALESCE("storeDescription", ''), ${search}) > ${similarityThreshold}
        OR similarity(COALESCE("firstName", ''), ${search}) > ${similarityThreshold}
        OR similarity(COALESCE("lastName", ''), ${search}) > ${similarityThreshold}
      )
      ORDER BY score DESC, "createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedCreators.length > 0 ? matchedCreators[0].total_count : 0;
    const items = matchedCreators.map((creator) => ({
      id: creator.id,
      index: 'creators' as const,
      type: 'creator',
      title: creator.storeName,
      subtitle: creator.storeDescription,
      score: Number(creator.score),
      payload: {
        id: creator.id,
        storeName: creator.storeName,
        storeDescription: creator.storeDescription,
        email: creator.email,
        firstName: creator.firstName,
        lastName: creator.lastName,
      },
    }));

    return { total, items };
  }

  private async searchCategoriesDb(
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedCategories = await this.prisma.$queryRaw<any[]>`
      SELECT id, name, description, slug,
        (CASE 
          WHEN name ILIKE ${ilikeSearch} THEN 2.0 + similarity(name, ${search})
          WHEN description ILIKE ${ilikeSearch} THEN 1.0 + similarity(COALESCE(description, ''), ${search})
          ELSE similarity(name, ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM categories
      WHERE "isActive" = true AND (
        name ILIKE ${ilikeSearch}
        OR COALESCE(description, '') ILIKE ${ilikeSearch}
        OR slug ILIKE ${ilikeSearch}
        OR similarity(name, ${search}) > ${similarityThreshold}
        OR similarity(COALESCE(description, ''), ${search}) > ${similarityThreshold}
        OR similarity(slug, ${search}) > ${similarityThreshold}
      )
      ORDER BY score DESC, "createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedCategories.length > 0 ? matchedCategories[0].total_count : 0;
    const items = matchedCategories.map((category) => ({
      id: category.id,
      index: 'categories' as const,
      type: 'category',
      title: category.name,
      subtitle: category.description ?? undefined,
      score: Number(category.score),
      payload: {
        id: category.id,
        name: category.name,
        description: category.description,
        slug: category.slug,
      },
    }));

    return { total, items };
  }

  private async searchUsersDb(
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedUsers = await this.prisma.$queryRaw<any[]>`
      SELECT u.id, u.email, u."firstName", u."lastName", rc.code as "referralCode",
        (CASE 
          WHEN u.email ILIKE ${ilikeSearch} THEN 3.0 + similarity(u.email, ${search})
          WHEN u."firstName" ILIKE ${ilikeSearch} OR u."lastName" ILIKE ${ilikeSearch} THEN 2.0 + similarity(COALESCE(u."firstName", '') || ' ' || COALESCE(u."lastName", ''), ${search})
          ELSE similarity(u.email, ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM users u
      LEFT JOIN referral_codes rc ON rc."userId" = u.id
      WHERE 
        u.email ILIKE ${ilikeSearch}
        OR u."firstName" ILIKE ${ilikeSearch}
        OR u."lastName" ILIKE ${ilikeSearch}
        OR rc.code ILIKE ${ilikeSearch}
        OR similarity(u.email, ${search}) > ${similarityThreshold}
        OR similarity(COALESCE(u."firstName", ''), ${search}) > ${similarityThreshold}
        OR similarity(COALESCE(u."lastName", ''), ${search}) > ${similarityThreshold}
      ORDER BY score DESC, u."createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedUsers.length > 0 ? matchedUsers[0].total_count : 0;
    const items = matchedUsers.map((user) => ({
      id: user.id,
      index: 'users' as const,
      type: 'user',
      title: user.email,
      subtitle: [user.firstName, user.lastName].filter(Boolean).join(' '),
      score: Number(user.score),
      payload: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        referralCode: user.referralCode ? { code: user.referralCode } : null,
      },
    }));

    return { total, items };
  }

  private async searchOrdersDb(
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedOrders = await this.prisma.$queryRaw<any[]>`
      SELECT o.id, o."orderNumber", o.status, o."discountCode", o."referralCode", o."shippingAddress", u.email as "userEmail",
        (CASE 
          WHEN o."orderNumber" ILIKE ${ilikeSearch} THEN 3.0 + similarity(o."orderNumber", ${search})
          WHEN u.email ILIKE ${ilikeSearch} THEN 2.0 + similarity(u.email, ${search})
          ELSE similarity(COALESCE(o."shippingAddress", ''), ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM orders o
      LEFT JOIN users u ON u.id = o."userId"
      WHERE 
        o."orderNumber" ILIKE ${ilikeSearch}
        OR o."discountCode" ILIKE ${ilikeSearch}
        OR o."referralCode" ILIKE ${ilikeSearch}
        OR o."shippingAddress" ILIKE ${ilikeSearch}
        OR u.email ILIKE ${ilikeSearch}
        OR similarity(o."orderNumber", ${search}) > ${similarityThreshold}
        OR similarity(COALESCE(o."shippingAddress", ''), ${search}) > ${similarityThreshold}
        OR similarity(u.email, ${search}) > ${similarityThreshold}
      ORDER BY score DESC, o."createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedOrders.length > 0 ? matchedOrders[0].total_count : 0;
    const items = matchedOrders.map((order) => ({
      id: order.id,
      index: 'orders' as const,
      type: 'order',
      title: order.orderNumber,
      subtitle: [order.userEmail, order.status, order.shippingAddress]
        .filter(Boolean)
        .join(' • '),
      score: Number(order.score),
      payload: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        discountCode: order.discountCode,
        referralCode: order.referralCode,
        shippingAddress: order.shippingAddress,
        user: order.userEmail ? { email: order.userEmail } : null,
      },
    }));

    return { total, items };
  }

  private async searchDiscountCodesDb(
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedDiscountCodes = await this.prisma.$queryRaw<any[]>`
      SELECT id, code, description,
        (CASE 
          WHEN code ILIKE ${ilikeSearch} THEN 2.0 + similarity(code, ${search})
          WHEN description ILIKE ${ilikeSearch} THEN 1.0 + similarity(COALESCE(description, ''), ${search})
          ELSE similarity(code, ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM discount_codes
      WHERE 
        code ILIKE ${ilikeSearch}
        OR COALESCE(description, '') ILIKE ${ilikeSearch}
        OR similarity(code, ${search}) > ${similarityThreshold}
        OR similarity(COALESCE(description, ''), ${search}) > ${similarityThreshold}
      ORDER BY score DESC, "createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedDiscountCodes.length > 0 ? matchedDiscountCodes[0].total_count : 0;
    const items = matchedDiscountCodes.map((discountCode) => ({
      id: discountCode.id,
      index: 'discount_codes' as const,
      type: 'discount_code',
      title: discountCode.code,
      subtitle: discountCode.description ?? undefined,
      score: Number(discountCode.score),
      payload: {
        id: discountCode.id,
        code: discountCode.code,
        description: discountCode.description,
      },
    }));

    return { total, items };
  }

  async searchCreatorGlobal(
    creatorId: string,
    search: string,
    types?: SearchIndex[],
    page = 1,
    limit = 10,
  ): Promise<SearchResponsePayload | null> {
    if (!search) {
      return null;
    }

    const indexes: SearchIndex[] =
      types && types.length
        ? types.filter((type) =>
          ['products', 'orders', 'discount_codes'].includes(type),
        )
        : ['products', 'orders', 'discount_codes'];

    return this.executeCreatorSearch(creatorId, indexes, search, page, limit);
  }

  async autocompleteCreator(
    creatorId: string,
    search: string,
    types?: SearchIndex[],
    limit = 10,
  ): Promise<SearchResultItem[] | null> {
    if (!search) {
      return null;
    }

    const indexes: SearchIndex[] =
      types && types.length
        ? types.filter((type) =>
          ['products', 'orders', 'discount_codes'].includes(type),
        )
        : ['products', 'orders', 'discount_codes'];

    const cacheKey = `search:creator:${creatorId}:autocomplete:${indexes.sort().join(',')}:${search}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SearchResultItem[];
    }

    const result = await this.executeCreatorSearch(creatorId, indexes, search, 1, limit);
    if (!result) {
      return null;
    }

    await this.redis.set(
      cacheKey,
      JSON.stringify(result.results),
      'EX',
      this.cacheTtlSeconds,
    );

    return result.results;
  }

  private async executeCreatorSearch(
    creatorId: string,
    indexes: SearchIndex[],
    search: string,
    page: number,
    limit: number,
  ): Promise<SearchResponsePayload | null> {
    const cacheKey = `search:creator:${creatorId}:${indexes.sort().join(',')}:${search}:${page}:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SearchResponsePayload;
    }

    const searchLimit = page * limit;
    const results = await Promise.all(
      indexes.map((index) => this.searchCreatorIndex(creatorId, index, search, searchLimit)),
    );

    const total = results.reduce((sum, entry) => sum + entry.total, 0);
    const items = results
      .flatMap((entry) => entry.items)
      .slice((page - 1) * limit, page * limit);

    const response = {
      results: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.redis.set(
      cacheKey,
      JSON.stringify(response),
      'EX',
      this.cacheTtlSeconds,
    );

    return response;
  }

  private async searchCreatorIndex(
    creatorId: string,
    index: SearchIndex,
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    switch (index) {
      case 'products':
        return this.searchCreatorProductsDb(creatorId, search, limit);
      case 'orders':
        return this.searchCreatorOrdersDb(creatorId, search, limit);
      case 'discount_codes':
        return this.searchCreatorDiscountCodesDb(creatorId, search, limit);
      default:
        return { items: [], total: 0 };
    }
  }

  private async searchCreatorProductsDb(
    creatorId: string,
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedProducts = await this.prisma.$queryRaw<any[]>`
      SELECT id, name, sku,
        (CASE 
          WHEN name ILIKE ${ilikeSearch} THEN 2.0 + similarity(name, ${search})
          WHEN sku ILIKE ${ilikeSearch} THEN 1.5 + similarity(sku, ${search})
          WHEN description ILIKE ${ilikeSearch} THEN 1.0 + similarity(COALESCE(description, ''), ${search})
          ELSE similarity(name, ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM products
      WHERE "creatorId" = ${creatorId} AND "isDeleted" = false AND (
        name ILIKE ${ilikeSearch}
        OR sku ILIKE ${ilikeSearch}
        OR COALESCE(description, '') ILIKE ${ilikeSearch}
        OR similarity(name, ${search}) > ${similarityThreshold}
        OR similarity(sku, ${search}) > ${similarityThreshold}
        OR similarity(COALESCE(description, ''), ${search}) > ${similarityThreshold}
      )
      ORDER BY score DESC, "createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedProducts.length > 0 ? matchedProducts[0].total_count : 0;
    const items = matchedProducts.map((product) => ({
      id: product.id,
      index: 'products' as const,
      type: 'product',
      title: product.name,
      subtitle: product.sku,
      score: Number(product.score),
      payload: {
        id: product.id,
        name: product.name,
        sku: product.sku,
      },
    }));

    return { total, items };
  }

  private async searchCreatorOrdersDb(
    creatorId: string,
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedOrders = await this.prisma.$queryRaw<any[]>`
      WITH unique_orders AS (
        SELECT DISTINCT o.id, o."orderNumber", o.status, o."discountCode", o."referralCode", o."shippingAddress", u.email as "userEmail", o."createdAt"
        FROM orders o
        LEFT JOIN users u ON u.id = o."userId"
        INNER JOIN order_items oi ON oi."orderId" = o.id
        WHERE oi."creatorId" = ${creatorId} AND (
          o."orderNumber" ILIKE ${ilikeSearch}
          OR o."discountCode" ILIKE ${ilikeSearch}
          OR o."referralCode" ILIKE ${ilikeSearch}
          OR o."shippingAddress" ILIKE ${ilikeSearch}
          OR u.email ILIKE ${ilikeSearch}
          OR similarity(o."orderNumber", ${search}) > ${similarityThreshold}
          OR similarity(COALESCE(o."shippingAddress", ''), ${search}) > ${similarityThreshold}
          OR similarity(u.email, ${search}) > ${similarityThreshold}
        )
      )
      SELECT id, "orderNumber", status, "discountCode", "referralCode", "shippingAddress", "userEmail",
        (CASE 
          WHEN "orderNumber" ILIKE ${ilikeSearch} THEN 3.0 + similarity("orderNumber", ${search})
          WHEN "userEmail" ILIKE ${ilikeSearch} THEN 2.0 + similarity("userEmail", ${search})
          ELSE similarity(COALESCE("shippingAddress", ''), ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM unique_orders
      ORDER BY score DESC, "createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedOrders.length > 0 ? matchedOrders[0].total_count : 0;
    const items = matchedOrders.map((order) => ({
      id: order.id,
      index: 'orders' as const,
      type: 'order',
      title: order.orderNumber,
      subtitle: [order.userEmail, order.status, order.shippingAddress]
        .filter(Boolean)
        .join(' • '),
      score: Number(order.score),
      payload: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        discountCode: order.discountCode,
        referralCode: order.referralCode,
        shippingAddress: order.shippingAddress,
        user: order.userEmail ? { email: order.userEmail } : null,
      },
    }));

    return { total, items };
  }

  private async searchCreatorDiscountCodesDb(
    creatorId: string,
    search: string,
    limit: number,
  ): Promise<{ items: SearchResultItem[]; total: number }> {
    const ilikeSearch = `%${search}%`;
    const similarityThreshold = 0.25;

    const matchedDiscountCodes = await this.prisma.$queryRaw<any[]>`
      SELECT id, code, description,
        (CASE 
          WHEN code ILIKE ${ilikeSearch} THEN 2.0 + similarity(code, ${search})
          WHEN description ILIKE ${ilikeSearch} THEN 1.0 + similarity(COALESCE(description, ''), ${search})
          ELSE similarity(code, ${search})
        END) as score,
        COUNT(*) OVER()::integer as total_count
      FROM discount_codes
      WHERE "creatorId" = ${creatorId} AND (
        code ILIKE ${ilikeSearch}
        OR COALESCE(description, '') ILIKE ${ilikeSearch}
        OR similarity(code, ${search}) > ${similarityThreshold}
        OR similarity(COALESCE(description, ''), ${search}) > ${similarityThreshold}
      )
      ORDER BY score DESC, "createdAt" DESC
      LIMIT ${limit};
    `;

    const total = matchedDiscountCodes.length > 0 ? matchedDiscountCodes[0].total_count : 0;
    const items = matchedDiscountCodes.map((discountCode) => ({
      id: discountCode.id,
      index: 'discount_codes' as const,
      type: 'discount_code',
      title: discountCode.code,
      subtitle: discountCode.description ?? undefined,
      score: Number(discountCode.score),
      payload: {
        id: discountCode.id,
        code: discountCode.code,
        description: discountCode.description,
      },
    }));

    return { total, items };
  }
}
