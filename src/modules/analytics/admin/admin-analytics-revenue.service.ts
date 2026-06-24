import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';

/*
 * Index recommendations for performance:
 *
 * - `orders` table:
 *   - Composite index on (status, "createdAt") covering status filtering + date range
 *     for revenue queries.
 *   - Index on ("createdAt") for groupBy/aggregation by date.
 *
 * - `order_items` table:
 *   - Index on ("orderId") for JOINs with orders (already covered by FK, but explicit
 *     index helps when filtering by order status).
 *   - Index on ("productId") for product-level aggregations.
 *   - Index on ("creatorId") for creator-level aggregations.
 */
import {
  DailyTrendDto,
  OrderStatusCountDto,
} from './dto/admin-analytics-summary.dto';

@Injectable()
export class AdminAnalyticsRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrderStatusCounts(): Promise<OrderStatusCountDto[]> {
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      orderBy: { status: 'asc' },
      _count: { status: true },
    });
    return rows.map((r) => ({
      status: r.status,
      count: r._count.status ?? 0,
    }));
  }

  /** Total revenue from non-cancelled orders */
  async getTotalRevenue(): Promise<number> {
    const r = await this.prisma.order.aggregate({
      _sum: { finalAmount: true },
      where: { status: { not: OrderStatus.CANCELLED } },
    });
    return Number(r._sum.finalAmount ?? 0);
  }

  /** Revenue in a given period from non-cancelled orders */
  async getRevenueInPeriod(start: Date, end: Date): Promise<number> {
    const r = await this.prisma.order.aggregate({
      _sum: { finalAmount: true },
      where: {
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: start, lte: end },
      },
    });
    return Number(r._sum.finalAmount ?? 0);
  }

  /** Daily revenue trend for a period */
  async getRevenueTrend(start: Date, end: Date): Promise<DailyTrendDto[]> {
    const rows = await this.prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        status: { not: OrderStatus.CANCELLED },
        createdAt: { gte: start, lte: end },
      },
      _sum: { finalAmount: true },
      orderBy: { createdAt: 'asc' },
    });

    const revenueRows = rows as Array<{
      createdAt: Date;
      _sum: { finalAmount: number | null };
    }>;
    return this.fillDateGaps(
      revenueRows.map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        value: Number(r._sum.finalAmount ?? 0),
      })),
      start,
      end,
    );
  }

  /** Daily order count trend */
  async getOrderTrend(start: Date, end: Date): Promise<DailyTrendDto[]> {
    const rows = await this.prisma.order.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    const orderRows = rows as Array<{
      createdAt: Date;
      _count: { id: number };
    }>;
    return this.fillDateGaps(
      orderRows.map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        value: r._count.id ?? 0,
      })),
      start,
      end,
    );
  }

  /** Average Order Value */
  async getAverageOrderValue(start?: Date, end?: Date): Promise<number> {
    const where: Parameters<typeof this.prisma.order.aggregate>[0]['where'] = {
      status: { not: OrderStatus.CANCELLED },
    };
    if (start || end) {
      where.createdAt = {};
      if (start) (where.createdAt as { gte?: Date }).gte = start;
      if (end) (where.createdAt as { lte?: Date }).lte = end;
    }
    const r = await this.prisma.order.aggregate({
      _avg: { finalAmount: true },
      where,
    });
    return Number(r._avg.finalAmount ?? 0);
  }

  /** Total orders count */
  async getTotalOrders(where?: Prisma.OrderWhereInput): Promise<number> {
    return this.prisma.order.count({ where });
  }

  /** New orders in period */
  async getNewOrdersInPeriod(start: Date, end: Date): Promise<number> {
    return this.prisma.order.count({
      where: { createdAt: { gte: start, lte: end } },
    });
  }

  /** Fills in zero-value days for missing dates */
  private fillDateGaps(
    data: DailyTrendDto[],
    start: Date,
    end: Date,
  ): DailyTrendDto[] {
    const map = new Map(data.map((d) => [d.date, d.value]));
    const result: DailyTrendDto[] = [];
    const current = new Date(start);
    while (current <= end) {
      const key = current.toISOString().slice(0, 10);
      result.push({ date: key, value: map.get(key) ?? 0 });
      current.setDate(current.getDate() + 1);
    }
    return result;
  }
}
