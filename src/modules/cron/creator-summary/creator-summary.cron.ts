import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { EmailProducer } from 'src/modules/queue/producers/email.producer';
import { CREATOR_SUMMARY } from 'src/modules/shared/constants';
import { generateJobId } from 'src/modules/shared/utils';

@Injectable()
export class CreatorSummaryCron {
  private readonly logger = new Logger(CreatorSummaryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProducer: EmailProducer,
  ) {}

  /**
   * Runs every Monday at 08:00 to send weekly earnings summaries to creators.
   */
  @Cron(CREATOR_SUMMARY.CRON_SCHEDULE, {
    name: 'creator-weekly-summary',
    timeZone: 'Africa/Lagos',
  })
  async handleWeeklySummary(): Promise<void> {
    this.logger.log('Running creator weekly summary cron job...');

    // Calculate the past week range
    const now = new Date();
    const weekEnd = new Date(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Find all approved active creators
    const creators = await this.prisma.creator.findMany({
      where: { isActive: true, isApproved: true },
      select: {
        id: true,
        email: true,
        storeName: true,
        creatorWallet: {
          select: { pendingBalance: true, balance: true },
        },
      },
    });

    let summariesSent = 0;

    for (const creator of creators) {
      // Get orders for this creator in the past week
      const weeklyOrders = await this.prisma.orderItem.findMany({
        where: {
          creatorId: creator.id,
          order: {
            createdAt: { gte: weekStart, lte: weekEnd },
            status: { not: 'CANCELLED' },
          },
        },
        include: {
          product: { select: { name: true } },
        },
      });

      if (weeklyOrders.length === 0) {
        // Skip creators with no activity (optional — comment out if you want to send zero-summary)
        continue;
      }

      const ordersCount = weeklyOrders.length;
      const revenue = weeklyOrders.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      );

      // Aggregate best-selling products
      const productSales = new Map<
        string,
        { name: string; quantity: number; revenue: number }
      >();

      for (const item of weeklyOrders) {
        const existing = productSales.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += Number(item.unitPrice) * item.quantity;
        } else {
          productSales.set(item.productId, {
            name: item.product.name,
            quantity: item.quantity,
            revenue: Number(item.unitPrice) * item.quantity,
          });
        }
      }

      const bestSellingProducts = Array.from(productSales.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const pendingBalance = Number(creator.creatorWallet?.pendingBalance) || 0;
      const settledBalance = Number(creator.creatorWallet?.balance) || 0;

      await this.emailProducer.sendWeeklySummary(
        {
          to: creator.email,
          creatorStoreName: creator.storeName,
          ordersCount,
          revenue,
          pendingBalance,
          settledBalance,
          bestSellingProducts,
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          currency: 'NGN',
        },
        {
          deduplication: {
            id: generateJobId('weekly-summary', creator.id, weekStartStr),
            ttl: 7 * 86400, // 7 days
          },
        },
      );

      summariesSent++;
    }

    this.logger.log(
      `Creator weekly summary cron complete: ${summariesSent} summaries sent out of ${creators.length} creators`,
    );
  }
}
