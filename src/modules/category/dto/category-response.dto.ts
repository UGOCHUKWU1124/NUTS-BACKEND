import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { CategoryType } from '../constants/category.constants';
import { ParentsubcategoryResponseDto } from './parentsubcategory-response.dto';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the category',
    example: 'c1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Display name of the category',
    example: 'Home & Living',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly slug derived from the category name',
    example: 'home-living',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the category',
    example: 'Products for home decoration and everyday living.',
  })
  description!: string | null;

  @ApiPropertyOptional({
    description: 'URL of the category image',
    example: 'https://example.com/images/category-home-living.jpg',
  })
  imageUrl!: string | null;

  @ApiProperty({
    description: 'The hierarchical type of this category node',
    example: 'Category',
  })
  type!: CategoryType;

  @ApiProperty({
    description: 'Depth level in the category hierarchy (0 = top-level)',
    example: 0,
  })
  depth!: number;

  @ApiProperty({
    description: 'Whether the category is currently active',
    example: true,
  })
  isActive!: boolean;

  @ApiPropertyOptional({
    description:
      'Unique identifier of the parent category (null for top-level)',
    example: null,
  })
  parentId!: string | null;

  @ApiProperty({
    description: 'Timestamp when the category was created',
    example: '2025-06-13T14:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the category was last updated',
    example: '2025-06-13T15:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'List of parent subcategories under this category',
    type: () => ParentsubcategoryResponseDto,
    isArray: true,
  })
  parentSubCategory!: ParentsubcategoryResponseDto[];
}
