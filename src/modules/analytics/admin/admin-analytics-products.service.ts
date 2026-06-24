import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import {
  TopProductDto,
  TopCategoryDto,
  TopCreatorDto,
} from './dto/admin-analytics-summary.dto';

@Injectable()
export class AdminAnalyticsProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTotalProducts(): Promise<number> {
    return this.prisma.product.count({ where: { isActive: true } });
  }

  async getTotalVariants(): Promise<number> {
    return this.prisma.productVariant.count({ where: { isActive: true } });
  }

  async getTotalCreators(): Promise<number> {
    return this.prisma.creator.count();
  }

  async getActiveCreators(): Promise<number> {
    return this.prisma.creator.count({ where: { isActive: true } });
  }

  async getVerifiedCreators(): Promise<number> {
    return this.prisma.creator.count({ where: { isVerified: true } });
  }

  async getApprovedCreators(): Promise<number> {
    return this.prisma.creator.count({ where: { isApproved: true } });
  }

  async getNewCreatorsInPeriod(start: Date, end: Date): Promise<number> {
    return this.prisma.creator.count({
      where: { createdAt: { gte: start, lte: end } },
    });
  }

  /** Top N products by revenue */
  async getTopProducts(limit: number): Promise<TopProductDto[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        product_id: string;
        name: string;
        sku: string;
        total_price: number;
        total_qty: number;
      }>
    >(
      `SELECT oi."productId" as product_id,
              p.name,
              p.sku,
              SUM(oi.price * oi.quantity) as total_price,
              SUM(oi.quantity) as total_qty
       FROM "order_items" oi
       JOIN "orders" o ON o.id = oi."orderId"
       JOIN "products" p ON p.id = oi."productId"
       WHERE o.status != 'CANCELLED'
       GROUP BY oi."productId", p.name, p.sku
       ORDER BY total_price DESC
       LIMIT $1`,
      limit,
    );

    return rows.map((r) => ({
      id: r.product_id,
      name: r.name ?? 'Deleted',
      sku: r.sku ?? '',
      totalSold: r.total_qty,
      revenue: r.total_price.toFixed(2),
    }));
  }

  /** Top N categories by revenue */
  async getTopCategories(limit: number): Promise<TopCategoryDto[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        slug: string;
        product_count: bigint;
        revenue: number;
      }>
    >(
      `SELECT c.id, c.name, c.slug,
              COUNT(DISTINCT oi."productId") as product_count,
              SUM(oi.price * oi.quantity) as revenue
       FROM "order_items" oi
       JOIN "orders" o ON o.id = oi."orderId"
       JOIN "products" p ON p.id = oi."productId"
       JOIN "categories" c ON c.id = p."categoryId"
       WHERE o.status != 'CANCELLED'
       GROUP BY c.id, c.name, c.slug
       ORDER BY revenue DESC
       LIMIT $1`,
      limit,
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name ?? 'Unknown',
      slug: r.slug ?? '',
      productCount: Number(r.product_count),
      revenue: r.revenue.toFixed(2),
    }));
  }

  /** Top N creators by revenue */
  async getTopCreators(limit: number): Promise<TopCreatorDto[]> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        creator_id: string;
        total_revenue: number;
        order_count: bigint;
      }>
    >(
      `SELECT oi."creatorId" as creator_id,
              SUM(oi.price * oi.quantity) as total_revenue,
              COUNT(DISTINCT oi."orderId") as order_count
       FROM "order_items" oi
       JOIN "orders" o ON o.id = oi."orderId"
       WHERE o.status != 'CANCELLED'
       GROUP BY oi."creatorId"
       ORDER BY total_revenue DESC
       LIMIT $1`,
      limit,
    );

    if (!rows.length) return [];

    const creatorIds = rows.map((r) => r.creator_id);
    const creators = await this.prisma.creator.findMany({
      where: { id: { in: creatorIds } },
      select: {
        id: true,
        storeName: true,
        email: true,
        _count: { select: { products: true } },
      },
    });
    const creatorMap = new Map(creators.map((c) => [c.id, c]));

    return rows.map((r) => {
      const c = creatorMap.get(r.creator_id);
      return {
        id: r.creator_id,
        storeName: c?.storeName ?? 'Deleted',
        email: c?.email ?? '',
        totalOrders: Number(r.order_count),
        revenue: r.total_revenue.toFixed(2),
        productCount: c?._count?.products ?? 0,
      };
    });
  }

  async getTotalCreatorOrderItems(): Promise<number> {
    return this.prisma.orderItem.count();
  }
}
