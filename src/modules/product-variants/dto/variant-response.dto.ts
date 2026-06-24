import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class VariantOptionDto {
  @ApiProperty({ description: 'Option name (e.g. size, color)' })
  name!: string;
  @ApiProperty({ description: 'Option value (e.g. M, Black)' })
  value!: string;
}

export class VariantSummaryDto {
  @ApiProperty({ description: 'Unique identifier of the variant' })
  id!: string;

  @ApiProperty({
    description: 'Variant options as array of {name, value} pairs',
    type: () => VariantOptionDto,
    isArray: true,
    example: [
      { name: 'size', value: 'M' },
      { name: 'color', value: 'Black' },
    ],
  })
  options!: VariantOptionDto[];

  @ApiProperty({ description: 'Stock quantity' })
  stock!: number;

  @ApiProperty({ description: 'Whether stock is available' })
  inStock!: boolean;

  @ApiProperty({ description: 'Stock status label' })
  stockStatus!: string;

  @ApiProperty({ description: 'Variant-specific images' })
  images!: string[];

  @ApiProperty({ description: 'Whether the variant is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether soft-deleted' })
  isDeleted!: boolean;

  @ApiPropertyOptional({ description: 'Soft-delete timestamp' })
  deletedAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

export class VariantResponseDto {
  @ApiProperty({ description: 'Unique identifier of the variant' })
  id!: string;

  @ApiProperty({
    description: 'Variant options as array of {name, value} pairs',
    type: () => VariantOptionDto,
    isArray: true,
    example: [
      { name: 'size', value: 'M' },
      { name: 'color', value: 'Black' },
    ],
  })
  options!: VariantOptionDto[];

  @ApiProperty({ description: 'Stock quantity' })
  stock!: number;

  @ApiProperty({ description: 'Whether stock is available' })
  inStock!: boolean;

  @ApiProperty({ description: 'Stock status label' })
  stockStatus!: string;

  @ApiProperty({ description: 'Variant-specific images' })
  images!: string[];

  @ApiPropertyOptional({ description: 'Parent product reference' })
  product?: any;

  @ApiProperty({ description: 'Whether the variant is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Whether soft-deleted' })
  isDeleted!: boolean;

  @ApiPropertyOptional({ description: 'Soft-delete timestamp' })
  deletedAt?: Date;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

export class ProductVariantProductRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional() imageUrl?: string | null;
}

export class ProductVariantListResponseDto {
  @ApiProperty({
    description: 'List of variants',
    type: () => VariantSummaryDto,
    isArray: true,
  })
  variants!: VariantSummaryDto[];

  @ApiProperty({
    description: 'Parent product',
    type: () => ProductVariantProductRefDto,
  })
  product!: ProductVariantProductRefDto;
}

export class AllVariantsResponseDto {
  @ApiProperty({
    type: () => VariantSummaryDto,
    isArray: true,
  })
  data!: VariantSummaryDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta!: { total: number; page: number; limit: number; totalPages: number };
}
