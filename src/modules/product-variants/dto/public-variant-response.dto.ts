import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class VariantOptionDto {
  @ApiProperty({ description: 'Option name (e.g. size, color)' })
  name!: string;
  @ApiProperty({ description: 'Option value (e.g. M, Black)' })
  value!: string;
}

export class PublicVariantSummaryDto {
  @ApiProperty() id!: string;

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

  @ApiProperty() stock!: number;
  @ApiProperty() inStock!: boolean;
  @ApiProperty() stockStatus!: string;
  @ApiProperty() images!: string[];

  @ApiProperty({ description: 'Whether the variant is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}

export class PublicVariantResponseDto {
  @ApiProperty() id!: string;

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

  @ApiProperty() stock!: number;
  @ApiProperty() inStock!: boolean;
  @ApiProperty() stockStatus!: string;
  @ApiProperty() images!: string[];

  @ApiPropertyOptional({ description: 'Parent product summary' })
  product?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
  };

  @ApiProperty({ description: 'Whether the variant is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt!: Date;
}
