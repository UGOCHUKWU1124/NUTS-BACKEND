import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductController } from './product.controller';
import { CategoriesModule } from '../category/categories.module';
import { SearchModule } from 'src/modules/shared/search/search.module';

@Module({
  imports: [CategoriesModule, SearchModule],
  controllers: [ProductController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
