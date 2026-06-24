import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AbandonedCartCron } from './abandoned-cart/abandoned-cart.cron';
import { LowStockCron } from './low-stock/low-stock.cron';
import { CreatorSummaryCron } from 'src/modules/analytics/cron-tasks/creator-summary.cron';
import { QueueModule } from 'src/modules/queue/queue.module';
import { PrismaModule } from 'src/modules/infrastructure/prisma/prisma.module';
import { RedisModule } from 'src/modules/infrastructure/redis/redis.module';

@Module({
  imports: [ScheduleModule.forRoot(), QueueModule, PrismaModule, RedisModule],
  providers: [AbandonedCartCron, LowStockCron, CreatorSummaryCron],
})
export class CronModule {}
