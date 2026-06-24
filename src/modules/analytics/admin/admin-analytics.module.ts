import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/modules/infrastructure/prisma/prisma.module';
import { CacheModule } from 'src/modules/infrastructure/cache/cache.module';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsRevenueService } from './admin-analytics-revenue.service';
import { AdminAnalyticsProductsService } from './admin-analytics-products.service';
import { AdminAnalyticsUsersService } from './admin-analytics-users.service';
import { AdminAnalyticsPromotionsService } from './admin-analytics-promotions.service';
import { AdminAnalyticsAuditService } from './admin-analytics-audit.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [AdminAnalyticsController],
  providers: [
    AdminAnalyticsService,
    AdminAnalyticsRevenueService,
    AdminAnalyticsProductsService,
    AdminAnalyticsUsersService,
    AdminAnalyticsPromotionsService,
    AdminAnalyticsAuditService,
  ],
})
export class AdminAnalyticsModule {}
