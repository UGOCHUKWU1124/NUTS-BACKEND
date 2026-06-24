import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { DiscountCodeType } from '@prisma/client';
import { Transform } from 'class-transformer';

export class CreateCreatorDiscountCodeDto {
  @ApiProperty({
    description:
      'Unique discount code. Will be uppercased and trimmed automatically.',
    example: 'SUMMER20',
  })
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => String(value).toUpperCase().replace(/\s/g, ''))
  code!: string;

  @ApiPropertyOptional({
    description: 'Description of the discount code.',
    example: '20% off summer sale',
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

  @ApiPropertyOptional({
    description:
      'Product IDs this discount applies to. If omitted or empty, the code applies to all of your products.',
    type: [String],
    example: [
      'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  applicableProductIds?: string[];
}
