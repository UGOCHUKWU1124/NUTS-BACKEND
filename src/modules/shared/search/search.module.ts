import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './search.service';
import { RedisModule } from 'src/modules/infrastructure/redis/redis.module';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
