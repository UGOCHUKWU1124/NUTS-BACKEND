import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { DailyTrendDto } from './dto/admin-analytics-summary.dto';

@Injectable()
export class AdminAnalyticsUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getTotalUsers(): Promise<number> {
    return this.prisma.user.count();
  }

  async getActiveUsers(): Promise<number> {
    return this.prisma.user.count({ where: { isActive: true } });
  }

  async getDeactivatedUsers(): Promise<number> {
    return this.prisma.user.count({ where: { isActive: false } });
  }

  async getNewUsersInPeriod(start: Date, end: Date): Promise<number> {
    return this.prisma.user.count({
      where: { createdAt: { gte: start, lte: end } },
    });
  }

  /** Users who have placed at least one order */
  async getUsersWithOrders(): Promise<number> {
    const [{ count }] = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(DISTINCT "userId") as count FROM "orders"`,
    );
    return Number(count);
  }

  /** Users with more than 1 order (repeat customers) */
  async getRepeatCustomers(): Promise<number> {
    const [{ count }] = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM (SELECT "userId" FROM "orders" GROUP BY "userId" HAVING COUNT(*) > 1) AS repeaters`,
    );
    return Number(count);
  }

  /** Daily registration trend */
  async getRegistrationTrend(start: Date, end: Date): Promise<DailyTrendDto[]> {
    const rows = await this.prisma.user.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    return this.fillDateGaps(
      rows.map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        value: r._count.id ?? 0,
      })),
      start,
      end,
    );
  }

  /** Cart → Checkout funnel */
  async getFunnel(start: Date, end: Date) {
    const [row] = await this.prisma.$queryRawUnsafe<
      Array<{
        total_carts: bigint;
        checked_out_carts: bigint;
        completed_orders: bigint;
      }>
    >(
      `SELECT
        (SELECT COUNT(*) FROM "carts" WHERE "createdAt" >= $1 AND "createdAt" <= $2) as total_carts,
        (SELECT COUNT(*) FROM "carts" WHERE "checkedOut" = true AND "createdAt" >= $1 AND "createdAt" <= $2) as checked_out_carts,
        (SELECT COUNT(*) FROM "orders" WHERE "status" != 'CANCELLED' AND "createdAt" >= $1 AND "createdAt" <= $2) as completed_orders`,
      start,
      end,
    );

    const totalCartsCreated = Number(row.total_carts);
    const cartsCheckedOut = Number(row.checked_out_carts);
    const ordersCompleted = Number(row.completed_orders);

    return {
      totalCartsCreated,
      cartsCheckedOut,
      ordersCompleted,
      cartAbandonmentRate:
        totalCartsCreated > 0
          ? Number(
              (
                ((totalCartsCreated - cartsCheckedOut) / totalCartsCreated) *
                100
              ).toFixed(1),
            )
          : 0,
      checkoutConversionRate:
        cartsCheckedOut > 0
          ? Number(((ordersCompleted / cartsCheckedOut) * 100).toFixed(1))
          : 0,
    };
  }

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
