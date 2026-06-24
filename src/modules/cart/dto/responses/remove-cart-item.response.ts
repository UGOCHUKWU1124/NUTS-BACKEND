import { ApiProperty } from '@nestjs/swagger';
import { CartMetadataDto } from '../cart-response.dto';

/**
 * Response for DELETE /cart/items/:productId
 * Returns the cart summary and the ID of the removed item.
 */
export class RemoveCartItemResponseDto {
  @ApiProperty({
    type: () => CartMetadataDto,
    description: 'The updated cart summary metadata',
  })
  cart!: CartMetadataDto;

  @ApiProperty({ description: 'ID of the cart item that was removed' })
  removedItemId!: string;
}
