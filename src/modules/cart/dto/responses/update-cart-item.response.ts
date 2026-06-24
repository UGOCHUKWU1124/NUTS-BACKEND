import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CartMetadataDto, CartItemResponseDto } from '../cart-response.dto';

/**
 * Response for PATCH /cart/items/:productId
 * Returns the cart summary and the item that was updated.
 * If the item quantity reached 0 and was removed, updatedItem is null.
 */
export class UpdateCartItemResponseDto {
  @ApiProperty({
    type: () => CartMetadataDto,
    description: 'The updated cart summary metadata',
  })
  cart!: CartMetadataDto;

  @ApiPropertyOptional({
    type: () => CartItemResponseDto,
    nullable: true,
    description:
      'The updated cart item (null if the item was removed due to quantity reaching 0)',
  })
  updatedItem?: CartItemResponseDto | null;
}
