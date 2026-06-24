import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductCategorySummaryDto {
  @ApiProperty({
    description: 'Unique identifier of the category',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Display name of the category',
    example: 'Leather Goods',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly category slug',
    example: 'leather-goods',
  })
  slug!: string;
}

export class ProductSummaryDto {
  @ApiProperty({
    description: 'Unique product identifier',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  id!: string;

  @ApiProperty({
    description: 'Product display name',
    example: 'Handcrafted Leather Bifold Wallet',
  })
  name!: string;

  @ApiProperty({
    description: 'URL-friendly product slug',
    example: 'handcrafted-leather-bifold-wallet',
  })
  slug!: string;

  @ApiProperty({
    description: 'Current selling price of the product',
    example: 79.99,
  })
  price!: number;

  @ApiProperty({
    description: 'Current stock quantity available',
    example: 45,
  })
  stock!: number;

  @ApiProperty({
    description: 'Whether the product is available for purchase',
    example: true,
  })
  inStock!: boolean;

  @ApiProperty({
    description: 'Product inventory status label',
    example: 'Few items left',
  })
  stockStatus!: string;

  @ApiProperty({
    description: 'Subcategory the product belongs to',
    type: ProductCategorySummaryDto,
  })
  subcategory!: ProductCategorySummaryDto;

  @ApiPropertyOptional({
    description: 'URL of the primary product image (nullable)',
    example: 'https://cdn.example.com/products/leather-bifold-wallet-1.jpg',
  })
  imageUrl!: string | null;

  @ApiProperty({
    description:
      'Whether the product is currently active and visible in the store',
    example: true,
  })
  isActive!: boolean;
}
