import { Module } from '@nestjs/common';
import { OrdersModule } from 'src/modules/orders/orders.module';
import { AdminOrdersController } from './admin-order.controller';

@Module({
  imports: [OrdersModule],
  controllers: [AdminOrdersController],
})
export class AdminOrdersModule {}
