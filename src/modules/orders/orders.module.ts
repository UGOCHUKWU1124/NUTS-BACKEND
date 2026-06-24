import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { UsersModule } from 'src/modules/users/users.module';
import { DiscountCodeModule } from 'src/modules/promotions/discount-code.module';
import { ReferralModule } from 'src/modules/referral/referral.module';
import { ShippingAddressesModule } from 'src/modules/shipping-addresses/shipping-addresses.module';
import { PaymentsModule } from 'src/modules/payments/payments.module';
import { WalletModule } from 'src/modules/wallet/wallet.module';

@Module({
  imports: [
    UsersModule,
    DiscountCodeModule,
    ReferralModule,
    ShippingAddressesModule,
    PaymentsModule,
    WalletModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
