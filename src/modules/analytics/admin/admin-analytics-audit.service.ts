import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import {
  DailyTrendDto,
  ActivityAnalyticsDto,
} from './dto/admin-analytics-summary.dto';

@Injectable()
export class AdminAnalyticsAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivityAnalytics(
    start: Date,
    end: Date,
  ): Promise<ActivityAnalyticsDto> {
    const totalActions = await this.prisma.auditLog.count({
      where: { createdAt: { gte: start, lte: end } },
    });

    // Unique admins who performed actions
    const adminCount = await this.prisma.auditLog.groupBy({
      by: ['adminId'],
      where: {
        adminId: { not: null },
        createdAt: { gte: start, lte: end },
      },
    });
    const uniqueAdmins = adminCount.filter((a) => a.adminId !== null).length;

    // Action breakdown
    const actionRows = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
    });
    const actionBreakdown: Record<string, number> = {};
    for (const r of actionRows) {
      actionBreakdown[r.action] = r._count.action ?? 0;
    }

    // Top admins by activity
    const adminActionRows = await this.prisma.auditLog.groupBy({
      by: ['adminId'],
      where: {
        adminId: { not: null },
        createdAt: { gte: start, lte: end },
      },
      _count: { adminId: true },
      orderBy: { _count: { adminId: 'desc' } },
      take: 10,
    });

    const adminIds = adminActionRows
      .map((r) => r.adminId)
      .filter((id): id is string => id !== null);

    let adminMap = new Map<string, string>();
    if (adminIds.length > 0) {
      const admins = await this.prisma.admin.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, email: true },
      });
      adminMap = new Map(admins.map((a) => [a.id, a.email]));
    }

    const topAdmins = adminActionRows
      .filter((r) => r.adminId !== null)
      .map((r) => ({
        adminId: r.adminId!,
        email: adminMap.get(r.adminId!) ?? 'Unknown',
        actionCount: r._count.adminId ?? 0,
      }));

    // Daily activity trend
    const trendRows = await this.prisma.auditLog.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: start, lte: end } },
      _count: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    const activityTrend = this.fillDateGaps(
      trendRows.map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        value: r._count.id ?? 0,
      })),
      start,
      end,
    );

    return {
      totalActions,
      uniqueAdmins,
      actionBreakdown,
      topAdmins,
      activityTrend,
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
