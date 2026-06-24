import { IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateVariantStockDto {
  @ApiProperty({
    description:
      'Stock delta adjustment. ' +
      'Use a **positive** integer to **add** stock (restock, return). ' +
      'Use a **negative** integer to **subtract** stock (fulfill an order, remove defective units).\n\n' +
      'The server validates that the resulting stock never goes below zero.',
    example: -2,
  })
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Reason for the stock adjustment (visible in stock history)',
    example: 'Inventory re-count',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
