import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim } from 'src/modules/shared/decorators/string-trim.decorator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name', minLength: 2, maxLength: 100 })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description:
      'URL-friendly slug. Auto-generated from name if omitted. ' +
      'Will be normalized (lowercased, spaces → hyphens, & → -and-, special chars stripped). ' +
      'Lowercase letters, numbers, and hyphens only after normalization.',
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({ description: 'Category description', maxLength: 500 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Category image URL' })
  @Trim()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description:
      'UUID of the parent category. If omitted, creates a root Category (depth 0).',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
