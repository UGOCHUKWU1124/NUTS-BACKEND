import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatorSummaryDto } from './creator-summary.dto';
import { PublicVariantSummaryDto } from 'src/modules/product-variants/dto/public-variant-response.dto';
import type { VariantCombinations } from 'src/modules/shared/dto/variant-combinations.dto';

class PublicProductCategoryRefDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  slug!: string;
}

export class PublicProductResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiProperty({ description: 'Product-level SKU' })
  sku!: string;

  @ApiProperty({ description: 'Whether the product has variants' })
  hasVariants!: boolean;

  @ApiPropertyOptional({ description: 'Product price when hasVariants=false' })
  price?: number;

  @ApiProperty({
    description: 'Product stock (or computed total across variants)',
  })
  stock!: number;

  @ApiProperty({ description: 'In stock flag' })
  inStock!: boolean;

  @ApiProperty({ description: 'Stock status label' })
  stockStatus!: string;

  @ApiPropertyOptional({
    description: 'Product-level discount price if applicable',
  })
  discountPrice?: number;

  @ApiPropertyOptional({
    description: 'Active variants',
    type: () => PublicVariantSummaryDto,
    isArray: true,
  })
  variants?: PublicVariantSummaryDto[];

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

  @ApiProperty({ type: () => CreatorSummaryDto })
  creator!: CreatorSummaryDto;

  @ApiProperty({ type: () => PublicProductCategoryRefDto })
  category!: PublicProductCategoryRefDto;

  @ApiPropertyOptional()
  imageUrl!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
