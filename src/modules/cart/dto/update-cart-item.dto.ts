import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    description:
      'Quantity to increment (positive) or decrement (negative) by. Decrementing to 0 or below removes the item.',
  })
  @Type(() => Number)
  @IsInt()
  quantity!: number;
}
