import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class QueryVariantDto {
  @ApiPropertyOptional({
    description:
      'Filter variants by product UUID. Provide this OR variantId, not both.',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description:
      'Retrieve a single variant by UUID. Provide this OR productId, not both.',
    type: String,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ description: 'Page number (default: 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page (default: 20, max: 100)',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
