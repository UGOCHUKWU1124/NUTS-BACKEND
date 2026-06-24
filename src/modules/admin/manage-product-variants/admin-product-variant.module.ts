import { Module } from '@nestjs/common';
import { ProductVariantsModule } from 'src/modules/product-variants/product-variants.module';
import { AdminProductVariantsController } from './admin-product-variant.controller';

@Module({
  imports: [ProductVariantsModule],
  controllers: [AdminProductVariantsController],
})
export class AdminProductVariantsModule {}
