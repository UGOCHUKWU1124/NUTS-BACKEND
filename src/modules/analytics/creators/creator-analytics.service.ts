import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { parseDateRange } from 'src/modules/shared/utils/date-range.util';
import { CreatorAnalyticsQueryDto } from './dto/creator-analytics-query.dto';
import {
  CreatorAnalyticsSummaryDto,
  CreatorDailyTrendDto,
} from './dto/creator-analytics-summary.dto';

@Injectable()
export class CreatorAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(
    creatorId: string,
    query: CreatorAnalyticsQueryDto,
  ): Promise<CreatorAnalyticsSummaryDto> {
    const { start, end } = parseDateRange(query.startDate, query.endDate, 30);
    const top = query.top ?? 10;

    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      outOfStockProducts,
      totalVariants,
      orderStatusCountsRaw,
      creatorOrderItems,
    ] = await this.prisma.$transaction([
      this.prisma.product.count({
        where: { creatorId, isDeleted: false },
      }),
      this.prisma.product.count({
        where: { creatorId, isDeleted: false, isActive: true },
      }),
      // Low stock products: computed differently for variants since stock is now per-option
      this.prisma.product.count({
        where: {
          creatorId,
          isDeleted: false,
          OR: [{ hasVariants: false, stock: { gt: 0, lte: 5 } }],
        },
      }),
      this.prisma.product.count({
        where: {
          creatorId,
          isDeleted: false,
          OR: [{ hasVariants: false, stock: 0 }],
        },
      }),
      this.prisma.productVariant.count({
        where: { product: { creatorId, isDeleted: false } },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        orderBy: { status: 'asc' },
        where: { orderItems: { some: { creatorId } } },
        _count: { status: true },
      }),
      this.prisma.orderItem.findMany({
        where: {
          creatorId,
          order: { status: { not: OrderStatus.CANCELLED } },
        },
        select: {
          unitPrice: true,
          totalPrice: true,
          quantity: true,
          order: { select: { createdAt: true } },
        },
      }),
    ]);

    // ── Compute variant-specific low stock / out of stock ──
    const variantProducts = await this.prisma.product.findMany({
      where: { creatorId, isDeleted: false, hasVariants: true },
      select: {
        id: true,
        variants: {
          where: { isDeleted: false, isActive: true },
          select: { stock: true },
        },
      },
    });

    let variantLowStockCount = 0;
    let variantOutOfStockCount = 0;
    const threshold = 5; // same as the product-level threshold

    for (const product of variantProducts) {
      const hasLowStock = product.variants.some(
        (v) => v.stock > 0 && v.stock <= threshold,
      );
      if (hasLowStock) variantLowStockCount++;

      const hasOutOfStock = !product.variants.some((v) => v.stock > 0);
      if (hasOutOfStock) variantOutOfStockCount++;
    }

    const adjustedLowStockProducts = lowStockProducts + variantLowStockCount;
    const adjustedOutOfStockProducts =
      outOfStockProducts + variantOutOfStockCount;

    // ── Derive total orders from status breakdown ──
    const totalOrders = orderStatusCountsRaw.reduce(
      (s, r) =>
        s +
        (typeof r._count === 'object' && r._count !== null
          ? ((r._count as Record<string, number>).status ?? 0)
          : 0),
      0,
    );

    // ── Revenue calculations ──
    const totalRevenue = creatorOrderItems.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );
    const revenueInPeriod = creatorOrderItems
      .filter(
        (item) => item.order.createdAt >= start && item.order.createdAt <= end,
      )
      .reduce((sum, item) => sum + Number(item.totalPrice), 0);

    // ── Trends ──
    const itemsByDate = new Map<string, number>();
    for (const item of creatorOrderItems) {
      const key = item.order.createdAt.toISOString().slice(0, 10);
      itemsByDate.set(
        key,
        (itemsByDate.get(key) ?? 0) + Number(item.totalPrice),
      );
    }
    const revenueTrend = this.fillDateGaps(
      [...itemsByDate.entries()]
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      start,
      end,
    );

    // ── Order trend ──
    const orderTrendRows = await this.prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        orderItems: { some: { creatorId } },
        createdAt: { gte: start, lte: end },
      },
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const newOrdersInPeriod = orderTrendRows.reduce(
      (s, r) => s + r._count.id,
      0,
    );
    const orderTrend = this.fillDateGaps(
      orderTrendRows.map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        value: r._count.id ?? 0,
      })),
      start,
      end,
    );

    // ── Order status breakdown ──
    const orderStatusCounts = orderStatusCountsRaw.map((entry) => ({
      status: entry.status,
      count:
        typeof entry._count === 'object' && entry._count !== null
          ? ((entry._count as Record<string, number>).status ?? 0)
          : 0,
    }));

    // ── Top products ──
    const topProducts = await this.getTopProducts(creatorId, top);

    // ── Customer insights ──
    const customers = await this.getCustomerSummary(
      creatorId,
      creatorOrderItems,
    );

    return {
      totalProducts,
      activeProducts,
      lowStockProducts: adjustedLowStockProducts,
      outOfStockProducts: adjustedOutOfStockProducts,
      totalVariants,
      totalOrders,
      newOrdersInPeriod,
      totalRevenue: totalRevenue.toFixed(2),
      revenueInPeriod: revenueInPeriod.toFixed(2),
      orderStatusCounts,
      revenueTrend,
      orderTrend,
      topProducts,
      customers,
    };
  }

  private async getTopProducts(creatorId: string, limit: number) {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        creatorId,
        order: { status: { not: OrderStatus.CANCELLED } },
      },
      _sum: { totalPrice: true, quantity: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });

    if (!rows.length) return [];

    const productIds = rows.map((r) => r.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        isActive: true,
        hasVariants: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return rows.map((r) => {
      const p = productMap.get(r.productId);
      return {
        id: r.productId,
        name: p?.name ?? 'Deleted',
        sku: p?.sku ?? '',
        totalSold: r._sum.quantity ?? 0,
        revenue: Number(r._sum.totalPrice ?? 0).toFixed(2),
        stock: p?.stock ?? 0,
        isActive: p?.isActive ?? false,
      };
    });
  }

  private async getCustomerSummary(
    creatorId: string,
    creatorOrderItems: {
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
      quantity: number;
      order: { createdAt: Date };
    }[],
  ) {
    // Unique buyers for this creator's products
    const [{ count: totalBuyers }] = await this.prisma.$queryRawUnsafe<
      { count: bigint }[]
    >(
      `SELECT COUNT(DISTINCT o."userId") as count FROM "order_items" oi
       JOIN "orders" o ON o.id = oi."orderId"
       WHERE oi."creatorId" = $1 AND o.status != 'CANCELLED'`,
      creatorId,
    );

    // Repeat buyers (>1 order with this creator's products)
    const [{ count: repeatBuyers }] = await this.prisma.$queryRawUnsafe<
      { count: bigint }[]
    >(
      `SELECT COUNT(*) as count FROM (
        SELECT o."userId" FROM "order_items" oi
        JOIN "orders" o ON o.id = oi."orderId"
        WHERE oi."creatorId" = $1 AND o.status != 'CANCELLED'
        GROUP BY o."userId" HAVING COUNT(DISTINCT o.id) > 1
      ) AS repeaters`,
      creatorId,
    );

    // AOV from already-fetched order items
    const aov =
      creatorOrderItems.length > 0
        ? creatorOrderItems.reduce(
            (sum, item) => sum + Number(item.totalPrice),
            0,
          ) / creatorOrderItems.length
        : 0;

    return {
      totalBuyers: Number(totalBuyers),
      repeatBuyers: Number(repeatBuyers),
      averageOrderValue: aov.toFixed(2),
    };
  }

  private fillDateGaps(
    data: CreatorDailyTrendDto[],
    start: Date,
    end: Date,
  ): CreatorDailyTrendDto[] {
    const map = new Map(data.map((d) => [d.date, d.value]));
    const result: CreatorDailyTrendDto[] = [];
    const current = new Date(start);
    while (current <= end) {
      const key = current.toISOString().slice(0, 10);
      result.push({ date: key, value: map.get(key) ?? 0 });
      current.setDate(current.getDate() + 1);
    }
    return result;
  }
}
