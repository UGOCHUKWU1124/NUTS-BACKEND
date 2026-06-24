import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminVariantResponseDto } from 'src/modules/product-variants/dto/admin-variant-response.dto';
import type { VariantCombinations } from 'src/modules/shared/dto/variant-combinations.dto';

class AdminProductCategoryRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

class AdminCreatorRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() storeName!: string;
  @ApiProperty() storeSlug!: string;
  @ApiPropertyOptional() storeLogoUrl?: string | null;
}

class AdminProductImageDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;
  @ApiProperty() position!: number;
}

export class AdminProductResponseDto {
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
    type: () => AdminVariantResponseDto,
    isArray: true,
  })
  variants?: AdminVariantResponseDto[];

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
  @ApiProperty({ type: () => AdminCreatorRefDto })
  creator!: AdminCreatorRefDto;
  @ApiProperty({ type: () => AdminProductCategoryRefDto })
  category!: AdminProductCategoryRefDto;
  @ApiPropertyOptional({ type: () => AdminProductImageDto, isArray: true })
  images?: AdminProductImageDto[];
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isDeleted!: boolean;
  @ApiPropertyOptional() deletedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
