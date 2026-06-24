import { Module } from '@nestjs/common';
import { CategoriesModule } from 'src/modules/category/categories.module';
import { AdminCategoryController } from './admin-category.controller';

@Module({
  imports: [CategoriesModule],
  controllers: [AdminCategoryController],
})
export class AdminCategoryModule {}
