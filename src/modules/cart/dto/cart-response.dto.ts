import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { VariantCombinations } from 'src/modules/shared/dto/variant-combinations.dto';

// ─── Shared building blocks for all cart response DTOs ───

export class CartMetadataDto {
  @ApiProperty({ description: 'Cart ID' })
  id!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Subtotal before discounts' })
  subtotal!: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  discountAmount?: number;

  @ApiProperty({ description: 'Delivery charge' })
  deliveryCharge!: number;

  @ApiProperty({ description: 'Service charge' })
  serviceCharge!: number;

  @ApiProperty({ description: 'Total amount' })
  totalAmount!: number;

  @ApiProperty({ description: 'Total number of items in cart' })
  totalItemCount!: number;

  @ApiProperty({ description: 'Abandoned cart alert sent' })
  abandonedCartAlerted!: boolean;

  @ApiPropertyOptional({
    description: 'Cart origin source',
    example: { type: 'PRODUCT_PAGE' },
  })
  addedFrom?: Record<string, string> | null;

  @ApiProperty({ description: 'Created at' })
  createdAt!: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Checked out status' })
  checkedOut!: boolean;
}

export class ProductAvailabilityDto {
  @ApiProperty() canAddToCart!: boolean;
  @ApiProperty() isAvailable!: boolean;
  @ApiProperty() sku!: string;
}

export class VariantOptionDto {
  @ApiProperty({ description: 'Option name (e.g. size, color)' })
  name!: string;
  @ApiProperty({ description: 'Option value (e.g. M, Black)' })
  value!: string;
}

export class CartItemVariantDto {
  @ApiProperty() id!: string;
  @ApiProperty({
    type: () => VariantOptionDto,
    isArray: true,
    description: 'Variant options',
    example: [
      { name: 'size', value: 'M' },
      { name: 'color', value: 'Black' },
    ],
  })
  options!: VariantOptionDto[];
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isDeleted!: boolean;
}

export class CartItemProductCategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}


export class CartItemProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() price!: number;
  @ApiProperty() inStockQuantity!: number;
  @ApiProperty() hasVariants!: boolean;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() isVariant!: boolean;
  @ApiProperty() lowStockAlert!: boolean;
  @ApiProperty() lowStockQuantity!: number;
  @ApiProperty() hasDiscount!: boolean;
  @ApiPropertyOptional() discountDetails?: any;

  @ApiPropertyOptional()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  images?: { url: string }[];

  @ApiPropertyOptional({ type: () => CartItemProductCategoryDto })
  category?: CartItemProductCategoryDto;

  @ApiPropertyOptional({ type: () => CartItemProductCategoryDto })
  subcategory?: CartItemProductCategoryDto;

  @ApiPropertyOptional()
  vendor?: { id: string; name: string };

  @ApiProperty({ type: () => ProductAvailabilityDto })
  productAvailability!: ProductAvailabilityDto;
}

export class CartItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() cartId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ type: () => CartItemProductDto })
  product!: CartItemProductDto;
  @ApiPropertyOptional({ type: () => CartItemVariantDto, nullable: true })
  variant?: CartItemVariantDto | null;
  @ApiProperty() quantity!: number;
  @ApiProperty() price!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

// ─── Base cart response — used as the common shape for all cart endpoints ───

export class CartResponseDto {
  @ApiProperty({ type: () => CartMetadataDto })
  cart!: CartMetadataDto;

  @ApiProperty({ type: () => CartItemResponseDto, isArray: true })
  cartItems!: CartItemResponseDto[];
}
