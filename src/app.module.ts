import { Module } from '@nestjs/common';

import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { JwtAuthGuard } from './modules/shared/guards/jwt-auth.guard';
import { OtpGuard } from './modules/shared/guards/otp.guard';

import { PrismaModule } from './modules/infrastructure/prisma/prisma.module';
import { RedisModule } from './modules/infrastructure/redis/redis.module';
import { CacheModule } from './modules/infrastructure/cache/cache.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CartModule } from './modules/cart/cart.module';
import { CategoriesModule } from './modules/category/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductVariantsModule } from './modules/product-variants/product-variants.module';
import { CreatorsModule } from './modules/creators/creators.module';
import { WishlistModule } from 'src/modules/wishlist/wishlist.module';
import { ReviewsModule } from 'src/modules/reviews/reviews.module';
import { WalletModule } from 'src/modules/wallet/wallet.module';
import { ReferralModule } from 'src/modules/referral/referral.module';
import { ShippingAddressesModule } from 'src/modules/shipping-addresses/shipping-addresses.module';
import { HealthModule } from './modules/health/health.module';

import { AdminUsersModule } from './modules/admin/manage-user/admin-user.module';
import { AdminProductModule } from './modules/admin/manage-products/admin-product.module';
import { AdminProductVariantsModule } from './modules/admin/manage-product-variants/admin-product-variant.module';
import { AdminOrdersModule } from './modules/admin/manage-orders/admin-order.module';
import { AdminAnalyticsModule } from './modules/analytics/admin/admin-analytics.module';
import { AdminAuthModule } from './modules/admin/auth/admin-auth.module';
import { AdminCreatorsModule } from './modules/admin/manage-creators/admin-creators.module';
import { AdminCacheModule } from './modules/admin/manage-cache/admin-cache.module';
import { AdminCategoryModule } from './modules/admin/manage-category/admin-category.module';
import { AdminPromotionModule } from './modules/admin/manage-promotions/admin-promotion.module';
import { SearchModule } from './modules/search/search.module';
import { AuditLogModule } from 'src/modules/shared/audit-log/audit-log.module';
import { UploadModule } from 'src/modules/shared/upload/upload.module';

// ── Priority 2 Infrastructure Modules ────────────────────
import { QueueModule } from './modules/queue/queue.module';
import { NotificationModule } from './modules/notification/notification.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CronModule } from './modules/cron/cron.module';
import { SecurityModule } from './modules/security/security.module';
import { BullMQModule } from './modules/infrastructure/bullmq/bullmq.module';
import { MailModule } from './modules/infrastructure/mail/mail.module';

import { validateEnv } from './modules/infrastructure/configuration/env.validation';
import { pinoLoggerConfig } from './modules/infrastructure/configuration/logger.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),
    LoggerModule.forRoot(pinoLoggerConfig()),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // ── Database & Core ────────────────────────────────
    PrismaModule,
    RedisModule,
    CacheModule,
    HealthModule,

    // ── Priority 1 Business Modules ────────────────────
    AuthModule,
    UsersModule,
    CartModule,
    CategoriesModule,
    OrdersModule,
    ProductsModule,
    PaymentsModule,
    ProductVariantsModule,
    CreatorsModule,
    WishlistModule,
    ReviewsModule,
    WalletModule,
    ReferralModule,
    ShippingAddressesModule,

    // ── Admin Modules ──────────────────────────────────
    AdminUsersModule,
    AdminProductModule,
    AdminProductVariantsModule,
    AdminOrdersModule,
    AdminAnalyticsModule,
    AdminAuthModule,
    AdminCreatorsModule,
    AdminCacheModule,
    AdminCategoryModule,
    AdminPromotionModule,
    SearchModule,
    AuditLogModule,
    UploadModule,

    // ── Priority 2 New Infrastructure ──────────────────
    BullMQModule,
    MailModule,
    QueueModule,
    NotificationModule,
    TrackingModule,
    AnalyticsModule,
    CronModule,
    SecurityModule,
  ],

  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OtpGuard },
  ],
})
export class AppModule {}
