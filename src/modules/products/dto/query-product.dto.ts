import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ToBoolean } from 'src/modules/shared/decorators/to-boolean.decorator';
import { PaginationQueryDto } from 'src/modules/shared/dto/pagination-query.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class QueryProductDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryPath?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  inStock?: boolean;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  /** Admin only: defaults to false (excludes soft-deleted). Pass true to list deleted products. */
  @ApiPropertyOptional({
    description: 'Admin: include soft-deleted products when true',
  })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  isDeleted?: boolean;

  /** Admin only: filter by active flag. Omit to include both active and inactive. */
  @ApiPropertyOptional({ description: 'Admin: filter by isActive when set' })
  @ToBoolean()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
