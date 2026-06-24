import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnalyticsSnapshotService {
  private readonly logger = new Logger(AnalyticsSnapshotService.name);
  private readonly defaultCurrency: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.defaultCurrency =
      this.configService.get<string>('DEFAULT_CURRENCY') || 'ngn';
  }

  /**
   * Generate a dashboard analytics snapshot.
   */
  async generateSnapshot(): Promise<{
    totalUsers: number;
    totalCreators: number;
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    totalRevenueFormatted: string;
    currency: string;
    snapshotDate: string;
  }> {
    const [totalUsers, totalCreators, totalProducts, orderAgg] =
      await Promise.all([
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.creator.count({
          where: { isActive: true, isApproved: true },
        }),
        this.prisma.product.count({
          where: { isActive: true, isDeleted: false },
        }),
        this.prisma.order.aggregate({
          _sum: { finalAmount: true },
          _count: true,
          where: { status: { not: 'CANCELLED' } },
        }),
      ]);

    const totalRevenue = Number(orderAgg._sum.finalAmount) || 0;

    return {
      totalUsers,
      totalCreators,
      totalProducts,
      totalOrders: orderAgg._count,
      totalRevenue,
      totalRevenueFormatted: `${this.defaultCurrency.toUpperCase()} ${totalRevenue.toFixed(2)}`,
      currency: this.defaultCurrency,
      snapshotDate: new Date().toISOString(),
    };
  }
}
