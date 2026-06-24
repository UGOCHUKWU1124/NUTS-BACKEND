import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ShippingAddressInput {
  @ApiProperty({
    description: 'Full name of the recipient',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty({
    description: 'Phone number for delivery contact',
    example: '+2348012345678',
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({
    description: 'Street address',
    example: '123 Main Street, Victoria Island',
  })
  @IsString()
  @IsNotEmpty()
  street!: string;

  @ApiProperty({ description: 'City', example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  city!: string;

  @ApiProperty({ description: 'State or region', example: 'Lagos State' })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiPropertyOptional({
    description: 'Country name',
    example: 'Nigeria',
    default: 'Nigeria',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  country?: string;
}

export class CheckoutDto {
  @ApiPropertyOptional({
    description:
      'Inline shipping address. Mutually exclusive with the addressId query parameter.',
    type: ShippingAddressInput,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressInput)
  shippingAddress?: ShippingAddressInput;

  @ApiPropertyOptional({
    description: 'Optional discount code to apply at checkout.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  discountCode?: string;
}
