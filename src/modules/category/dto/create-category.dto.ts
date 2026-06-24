import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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
      'URL-friendly slug. Auto-generated from name if omitted. Lowercase letters, numbers, and hyphens only.',
    maxLength: 120,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      'Slug must be lowercase and contain only letters, numbers, and hyphens (e.g. my-category)',
  })
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
