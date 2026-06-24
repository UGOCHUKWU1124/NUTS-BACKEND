import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import {
  DiscountAnalyticsDto,
  ReferralAnalyticsDto,
  PaymentAnalyticsDto,
} from './dto/admin-analytics-summary.dto';

@Injectable()
export class AdminAnalyticsPromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Discounts ──────────────────────────────────────────

  async getDiscountAnalytics(): Promise<DiscountAnalyticsDto> {
    const [totalCodes, activeCodes, usageAgg, topCodesRaw] =
      await this.prisma.$transaction([
        this.prisma.discountCode.count(),
        this.prisma.discountCode.count({ where: { isActive: true } }),
        this.prisma.order.aggregate({
          _sum: { discountAmount: true },
          where: {
            discountAmount: { gt: 0 },
            status: { not: 'CANCELLED' },
          },
        }),
        this.prisma.discountCode.findMany({
          where: { usageCount: { gt: 0 } },
          orderBy: { usageCount: 'desc' },
          take: 10,
          select: { code: true, usageCount: true },
        }),
      ]);

    // Estimate discount per code (orders × code = rough)
    const topCodes = topCodesRaw.map((c) => ({
      code: c.code,
      usageCount: c.usageCount,
      totalDiscount: '0.00', // would need join to order for exact
    }));

    return {
      totalCodes,
      activeCodes,
      totalUsages: topCodesRaw.reduce((s, c) => s + c.usageCount, 0),
      totalDiscountGiven: Number(usageAgg._sum.discountAmount ?? 0).toFixed(2),
      topCodes,
    };
  }

  // ── Referrals ──────────────────────────────────────────

  async getReferralAnalytics(): Promise<ReferralAnalyticsDto> {
    const [totalReferrals, rewardAgg] = await this.prisma.$transaction([
      this.prisma.referral.count(),
      this.prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: { reason: 'REFERRAL_REWARD' },
      }),
    ]);

    return {
      totalReferrals,
      referredUsersConverted: totalReferrals,
      totalDiscountGiven: Number(rewardAgg._sum.amount ?? 0).toFixed(2),
    };
  }

  // ── Payments ───────────────────────────────────────────

  async getPaymentAnalytics(): Promise<PaymentAnalyticsDto> {
    const [totalPayments, successfulPayments, failedPayments, refundedAgg] =
      await this.prisma.$transaction([
        this.prisma.payment.count(),
        this.prisma.payment.count({
          where: { status: 'COMPLETED' },
        }),
        this.prisma.payment.count({
          where: { status: 'FAILED' },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: 'REFUNDED' },
        }),
      ]);

    // Revenue grouped by payment method
    const byMethod = await this.prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    });
    const revenueByMethod: Record<string, string> = {};
    for (const m of byMethod) {
      const key = m.paymentMethod ?? 'unknown';
      revenueByMethod[key] = Number(m._sum.amount ?? 0).toFixed(2);
    }

    return {
      totalPayments,
      successfulPayments,
      failedPayments,
      refundedAmount: Number(refundedAgg._sum.amount ?? 0).toFixed(2),
      revenueByMethod,
      successRate:
        totalPayments > 0
          ? Number(((successfulPayments / totalPayments) * 100).toFixed(1))
          : 0,
    };
  }
}
