import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OtpService } from 'src/modules/auth/services/otp.service';
import { AuthCookiesModule } from 'src/modules/auth/auth-cookies.module';
import { OrdersModule } from 'src/modules/orders/orders.module';
import { ProductVariantsModule } from 'src/modules/product-variants/product-variants.module';
import { ProductsModule } from 'src/modules/products/products.module';
import { DiscountCodeModule } from 'src/modules/promotions/discount-code.module';
import { WalletModule } from 'src/modules/wallet/wallet.module';
import { PrismaModule } from 'src/modules/infrastructure/prisma/prisma.module';
import { SecurityModule } from 'src/modules/security/security.module';
import { CreatorAnalyticsService } from 'src/modules/analytics/creators/creator-analytics.service';
import { CreatorAnalyticsController } from 'src/modules/analytics/creators/creator-analytics.controller';
import { PublicStoreController } from './public-store.controller';
import { CreatorAccountController } from './creator-account.controller';
import { CreatorDiscountCodesController } from './creator-discount-codes.controller';
import { CreatorOrdersController } from './creator-orders.controller';
import { CreatorProductVariantsController } from './creator-product-variants.controller';
import { CreatorProductsController } from './creator-products.controller';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { CreatorWalletController } from './manage-wallet/creator-wallet.controller';
import { CreatorJwtStrategy } from './strategies/creator-jwt.strategy';
import { CreatorRefreshTokenStrategy } from './strategies/creator-refresh-token.strategy';

@Module({
  imports: [
    AuthCookiesModule,
    DiscountCodeModule,
    JwtModule,
    OrdersModule,
    PrismaModule,
    ProductVariantsModule,
    ProductsModule,
    SecurityModule,
    WalletModule,
  ],
  controllers: [
    PublicStoreController,
    CreatorAccountController,
    CreatorAnalyticsController,
    CreatorDiscountCodesController,
    CreatorOrdersController,
    CreatorProductVariantsController,
    CreatorProductsController,
    CreatorsController,
    CreatorWalletController,
  ],
  providers: [
    CreatorAnalyticsService,
    CreatorJwtStrategy,
    CreatorRefreshTokenStrategy,
    CreatorsService,
    OtpService,
  ],
  exports: [CreatorsService],
})
export class CreatorsModule {}
