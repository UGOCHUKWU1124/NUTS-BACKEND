import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { AdminSearchController } from './admin-search.controller';
import { CreatorSearchController } from './creator-search.controller';
import { SearchModule as CommonSearchModule } from 'src/modules/shared/search/search.module';
import { PrismaModule } from 'src/modules/infrastructure/prisma/prisma.module';

@Module({
  imports: [CommonSearchModule, PrismaModule],
  controllers: [
    SearchController,
    AdminSearchController,
    CreatorSearchController,
  ],
})
export class SearchModule {}
