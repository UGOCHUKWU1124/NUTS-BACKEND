import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { CategoryType } from '../constants/category.constants';

export class SubcategoryResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the subcategory',
    example: 's1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Display name of the subcategory',
    example: 'Ceramic Vases',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug derived from the subcategory name',
    example: 'ceramic-vases',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the subcategory',
    example: 'Handcrafted ceramic vases in various shapes and sizes.',
  })
  description!: string | null;

  @ApiPropertyOptional({
    description: 'URL of the subcategory image',
    example: 'https://example.com/images/subcategory-ceramic-vases.jpg',
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'The hierarchical type of this category node',
    example: 'Subcategory',
  })
  type!: CategoryType;

  @ApiProperty({
    description: 'Depth level in the category hierarchy (2 = leaf level)',
    example: 2,
  })
  depth!: number;

  @ApiProperty({
    description: 'Whether the subcategory is currently active',
    example: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Unique identifier of the parent subcategory',
    example: 'p1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  parentId!: string | null;

  @ApiProperty({
    description: 'Timestamp when the subcategory was created',
    example: '2025-06-13T14:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the subcategory was last updated',
    example: '2025-06-13T15:00:00.000Z',
  })
  updatedAt!: Date;
}
