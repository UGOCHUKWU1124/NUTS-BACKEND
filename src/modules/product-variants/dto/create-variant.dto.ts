import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class VariantOptionItemDto {
  @ApiProperty({ description: 'Option name (e.g. size, color)' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Option value (e.g. M, Black)' })
  @IsString()
  @IsNotEmpty()
  value!: string;
}

export class CreateVariantDto {
  @ApiProperty({
    description: 'Variant options as array of {name, value} pairs',
    example: [
      { name: 'size', value: 'M' },
      { name: 'color', value: 'Black' },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VariantOptionItemDto)
  options!: VariantOptionItemDto[];

  @ApiProperty({ description: 'Stock quantity', example: 5 })
  @IsNumber()
  @Min(0)
  stock!: number;

  @ApiPropertyOptional({ description: 'Variant-specific image URLs' })
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
