import { Module } from '@nestjs/common';
import { ProductsModule } from 'src/modules/products/products.module';
import { AdminProductsController } from './admin-product.controller';

@Module({
  imports: [ProductsModule],
  controllers: [AdminProductsController],
})
export class AdminProductModule {}
