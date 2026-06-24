import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 5, description: 'Rating from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({
    example: 'Great product!',
    description: 'Optional comment',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiProperty({ description: 'The ID of the product being reviewed' })
  @IsString()
  @IsNotEmpty()
  productId!: string;
}

export class ReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() rating!: number;
  @ApiPropertyOptional() comment?: string | null;
  @ApiProperty() productId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() userFirstName?: string | null;
  @ApiProperty() userLastName?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
