import { Module } from '@nestjs/common';
import { AdminCacheController } from './admin-cache.controller';

@Module({
  controllers: [AdminCacheController],
})
export class AdminCacheModule {}
