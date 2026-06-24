import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShippingAddressDto {
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

  @ApiPropertyOptional({
    description: 'Set as default shipping address',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
