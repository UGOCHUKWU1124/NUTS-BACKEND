import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { CategoryType } from '../constants/category.constants';
import { SubcategoryResponseDto } from './subcategory-response.dto';

export class ParentsubcategoryResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the parent subcategory',
    example: 'p1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Display name of the parent subcategory',
    example: 'Vases & Planters',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug derived from the parent subcategory name',
    example: 'vases-planters',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the parent subcategory',
    example: 'A collection of vases and planters for home decor.',
  })
  description!: string | null;

  @ApiPropertyOptional({
    description: 'URL of the parent subcategory image',
    example: 'https://example.com/images/parentsubcategory-vases-planters.jpg',
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'The hierarchical type of this category node',
    example: 'Parentsubcategory',
  })
  type!: CategoryType;

  @ApiProperty({
    description:
      'Depth level in the category hierarchy (1 = intermediate level)',
    example: 1,
  })
  depth!: number;

  @ApiProperty({
    description: 'Whether the parent subcategory is currently active',
    example: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    description: 'Unique identifier of the parent category',
    example: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  parentId!: string | null;

  @ApiProperty({
    description: 'Timestamp when the parent subcategory was created',
    example: '2025-06-13T14:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the parent subcategory was last updated',
    example: '2025-06-13T15:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'List of subcategories under this parent subcategory',
    type: () => SubcategoryResponseDto,
    isArray: true,
  })
  subCategory!: SubcategoryResponseDto[];
}
