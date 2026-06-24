import { Module } from '@nestjs/common';
import { ShippingAddressesService } from './shipping-addresses.service';
import { ShippingAddressesController } from './shipping-addresses.controller';
@Module({
  controllers: [ShippingAddressesController],
  providers: [ShippingAddressesService],
  exports: [ShippingAddressesService],
})
export class ShippingAddressesModule {}
