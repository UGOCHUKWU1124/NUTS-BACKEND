import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatorSummaryDto } from './creator-summary.dto';
import { VariantSummaryDto } from 'src/modules/product-variants/dto/variant-response.dto';
import type { VariantCombinations } from 'src/modules/shared/dto/variant-combinations.dto';

class ProductCategoryRefDto {
  @ApiProperty({ description: 'Unique identifier of the category' })
  id!: string;

  @ApiProperty({ description: 'Display name of the category' })
  name!: string;

  @ApiProperty({ description: 'URL-friendly category slug' })
  slug!: string;
}

export class ProductResponseDto {
  @ApiProperty({ description: 'Unique identifier of the product' })
  id!: string;

  @ApiProperty({ description: 'Display name of the product' })
  name!: string;

  @ApiProperty({ description: 'URL-friendly slug' })
  slug!: string;

  @ApiPropertyOptional({ description: 'Detailed description of the product' })
  description!: string | null;

  @ApiProperty({ description: 'Product-level SKU', example: 'TSHIRT-001' })
  sku!: string;

  @ApiProperty({ description: 'Whether the product has variants' })
  hasVariants!: boolean;

  @ApiPropertyOptional({
    description: 'Product price (used when hasVariants=false)',
  })
  price?: number;

  @ApiProperty({
    description: 'Product stock (or computed total across variants)',
  })
  stock!: number;

  @ApiProperty({ description: 'Whether the product is available for purchase' })
  inStock!: boolean;

  @ApiProperty({ description: 'Human-readable inventory status' })
  stockStatus!: string;

  @ApiPropertyOptional({
    description: 'Variants associated with the product',
    type: () => VariantSummaryDto,
    isArray: true,
  })
  variants?: VariantSummaryDto[];

  @ApiPropertyOptional({
    description:
      'Grouped unique option values across all variants — useful for building filter UIs. ' +
      'Only present when the product has variants.',
    example: { size: ['S', 'M', 'L'], color: ['Black', 'Red'] },
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { type: 'string' },
    },
  })
  variantCombinations?: VariantCombinations;

  @ApiProperty({
    description: 'The creator who owns this product',
    type: () => CreatorSummaryDto,
  })
  creator!: CreatorSummaryDto;

  @ApiProperty({
    description: 'Category this product belongs to',
    type: () => ProductCategoryRefDto,
  })
  category!: ProductCategoryRefDto;

  @ApiPropertyOptional({ description: 'URL of the primary product image' })
  imageUrl!: string | null;

  @ApiProperty({ description: 'Whether the product is active and visible' })
  isActive!: boolean;

  @ApiProperty({ description: 'Timestamp when created' })
  createdAt!: Date;

  @ApiProperty({ description: 'Timestamp when last updated' })
  updatedAt!: Date;
}
