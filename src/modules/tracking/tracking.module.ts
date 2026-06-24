import { Module } from '@nestjs/common';
import { QueueModule } from 'src/modules/queue/queue.module';
import { RedisModule } from 'src/modules/infrastructure/redis/redis.module';
import { ProductViewsService } from './product-views/product-views.service';
import { SearchTrackingService } from './search-tracking/search-tracking.service';

@Module({
  imports: [QueueModule, RedisModule],
  providers: [ProductViewsService, SearchTrackingService],
  exports: [ProductViewsService, SearchTrackingService],
})
export class TrackingModule {}
