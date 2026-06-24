import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShippingAddressResponseDto } from 'src/modules/shipping-addresses/dto/shipping-address-response.dto';

export class ShippingInformationResponseDto {
  @ApiPropertyOptional({
    type: ShippingAddressResponseDto,
    description: 'Default saved shipping address for the user',
    nullable: true,
  })
  defaultAddress!: ShippingAddressResponseDto | null;

  @ApiProperty({
    type: [ShippingAddressResponseDto],
    description: 'All saved shipping addresses for this user',
    example: [],
  })
  addresses!: ShippingAddressResponseDto[];
}
