import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class AddedFromDto {
  @ApiProperty({ enum: ['CATEGORY_PAGE', 'PRODUCT_PAGE'] })
  @IsString()
  @IsIn(['CATEGORY_PAGE', 'PRODUCT_PAGE'])
  type!: 'CATEGORY_PAGE' | 'PRODUCT_PAGE';
}

export { AddedFromDto };

export class AddToCartQuantityDto {
  @ApiProperty({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    type: () => AddedFromDto,
    description: 'The page from which the item was added to cart',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AddedFromDto)
  addedFrom?: AddedFromDto;
}
