import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddToWishlistDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;
}

export class WishlistResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() productId!: string;
  @ApiPropertyOptional({ nullable: true }) variantId?: string | null;
  @ApiProperty() productName!: string;
  @ApiProperty() productSlug!: string;
  @ApiProperty() productPrice!: number;
  @ApiPropertyOptional({ nullable: true }) variantName?: string | null;
  @ApiProperty() createdAt!: Date;
}
