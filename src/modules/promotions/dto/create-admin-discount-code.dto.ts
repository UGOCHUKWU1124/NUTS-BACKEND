import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { DiscountCodeType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateAdminDiscountCodeDto {
  @ApiProperty({
    description:
      'Unique discount code. Will be uppercased and trimmed automatically.',
    example: 'WELCOME20',
  })
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => String(value).toUpperCase().replace(/\s/g, ''))
  code!: string;

  @ApiPropertyOptional({
    description: 'Description of the discount code.',
    example: '20% off for new customers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  description?: string;

  @ApiProperty({ enum: DiscountCodeType, description: 'PERCENTAGE or FIXED' })
  @IsEnum(DiscountCodeType)
  type!: DiscountCodeType;

  @ApiProperty({
    description:
      'Discount value. For PERCENTAGE, this is the percentage. For FIXED, this is the flat amount.',
    example: 20,
  })
  @IsPositive()
  @IsNumber({ maxDecimalPlaces: 2 })
  value!: number;

  @ApiPropertyOptional({
    description:
      'Maximum discount amount (only meaningful when type is PERCENTAGE).',
    example: 5000,
  })
  @IsOptional()
  @IsPositive()
  @IsNumber({ maxDecimalPlaces: 2 })
  maxDiscountAmount?: number;

  @ApiPropertyOptional({
    description: 'Minimum order amount required to use this code.',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderAmount?: number;

  @ApiPropertyOptional({
    description:
      'Maximum number of times a single user may use this code. If omitted, unlimited.',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  usageLimit?: number;

  @ApiPropertyOptional({
    description: 'Whether the code is active. Defaults to true.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'ISO date string when the code becomes valid.',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    description: 'ISO date string when the code expires.',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
