import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatorVariantResponseDto } from 'src/modules/product-variants/dto/creator-variant-response.dto';
import type { VariantCombinations } from 'src/modules/shared/dto/variant-combinations.dto';

class CreatorProductCategoryRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

class CreatorProductImageDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;
  @ApiProperty() position!: number;
}

export class CreatorProductResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() sku!: string;
  @ApiProperty() hasVariants!: boolean;
  @ApiPropertyOptional() price?: number;
  @ApiProperty() stock!: number;
  @ApiProperty() inStock!: boolean;
  @ApiProperty() stockStatus!: string;
  @ApiPropertyOptional({
    type: () => CreatorVariantResponseDto,
    isArray: true,
  })
  variants?: CreatorVariantResponseDto[];

  @ApiPropertyOptional({
    description:
      'Grouped unique option values across all variants — useful for building filter UIs',
    example: { size: ['S', 'M', 'L'], color: ['Black', 'Red'] },
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { type: 'string' },
    },
  })
  variantCombinations?: VariantCombinations;
  @ApiProperty({ type: () => CreatorProductCategoryRefDto })
  category!: CreatorProductCategoryRefDto;
  @ApiPropertyOptional({ type: () => CreatorProductImageDto, isArray: true })
  images?: CreatorProductImageDto[];
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isDeleted!: boolean;
  @ApiPropertyOptional() deletedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
