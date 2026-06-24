import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchProductCreatorDto {
  @ApiProperty({
    description: 'URL-friendly slug of the creator store',
    example: 'artisan-leather-co',
  })
  slug!: string;

  @ApiPropertyOptional({
    description: 'URL of the store logo image (nullable)',
    example: 'https://cdn.example.com/logos/artisan-leather-co.png',
  })
  logo!: string | null;

  @ApiPropertyOptional({
    description: 'URL of the store banner image (nullable)',
    example: 'https://cdn.example.com/banners/artisan-leather-co.jpg',
  })
  banner!: string | null;

  @ApiProperty({
    description: 'Registered business name of the creator store',
    example: 'Artisan Leather Co.',
  })
  businessName!: string;
}

export class SearchProductCategoryDto {
  @ApiProperty({
    description: 'Unique identifier of the category',
    example: 'cat_leather_goods',
  })
  id!: string;

  @ApiProperty({
    description: 'URL-friendly category slug',
    example: 'leather-goods',
  })
  slug!: string;

  @ApiProperty({
    description: 'Display name of the category',
    example: 'Leather Goods',
  })
  name!: string;
}

export class SearchProductHitDto {
  @ApiProperty({
    description: 'Algolia hit type indicator (typically "product")',
    example: 'product',
  })
  type!: string;

  @ApiProperty({
    description: 'Product display title',
    example: 'Handcrafted Leather Bifold Wallet',
  })
  title!: string;

  @ApiPropertyOptional({
    description: 'Short product description (nullable)',
    example:
      'Premium full-grain leather wallet with 6 card slots and a bill compartment.',
  })
  description!: string | null;

  @ApiPropertyOptional({
    description: 'URL of the primary product image (nullable)',
    example: 'https://cdn.example.com/products/leather-bifold-wallet-1.jpg',
  })
  image!: string | null;

  @ApiProperty({
    description:
      'Search keywords associated with this product for improved discoverability',
    type: [String],
    example: ['wallet', 'leather', 'bifold', 'mens wallet', 'gift'],
  })
  searchKeywords!: string[];

  @ApiProperty({
    description: 'Timestamp when the product was first indexed/created',
    example: '2025-03-15T10:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Timestamp when the product was last updated',
    example: '2025-06-10T14:22:00.000Z',
  })
  updatedAt!: Date;

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
    description: 'Creator/store information associated with the product',
    type: SearchProductCreatorDto,
  })
  creator!: SearchProductCreatorDto;

  @ApiProperty({
    description: 'Category the product belongs to',
    type: SearchProductCategoryDto,
  })
  category!: SearchProductCategoryDto;

  @ApiPropertyOptional({
    description: 'Subcategory the product belongs to (nullable)',
    type: SearchProductCategoryDto,
  })
  subcategory?: SearchProductCategoryDto | null;

  @ApiPropertyOptional({
    description: 'Section or department the product is listed under (nullable)',
    example: 'men-accessories',
  })
  section!: string | null;

  @ApiProperty({
    description:
      'Indicates whether the product currently has an active discount',
    example: true,
  })
  hasDiscount!: boolean;

  @ApiPropertyOptional({
    description:
      'Details about the active discount (nullable; includes type, value, and expiry)',
    example: {
      type: 'percentage',
      value: 20,
      expiresAt: '2025-07-15T23:59:59.000Z',
    },
  })
  discountDetails!: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Algolia objectID used for ranking and deduplication',
    example: 'product_a1b2c3d4e5f6',
  })
  objectID!: string;

  @ApiPropertyOptional({
    description:
      'Algolia highlight result for matched search terms (present when highlighting is enabled)',
    example: {
      title: {
        value: 'Handcrafted <em>Leather</em> Bifold Wallet',
        matchLevel: 'full',
      },
    },
  })
  _highlightResult?: Record<string, unknown>;
}
