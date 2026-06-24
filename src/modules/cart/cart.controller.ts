import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { CartService } from './cart.service';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { AddToCartResponseDto } from './dto/responses/add-to-cart.response';
import { ClearCartResponseDto } from './dto/responses/clear-cart.response';
import { GetCartResponseDto } from './dto/responses/get-cart.response';
import { RemoveCartItemResponseDto } from './dto/responses/remove-cart-item.response';
import { UpdateCartItemResponseDto } from './dto/responses/update-cart-item.response';
import { AddToCartQuantityDto } from './dto/add-to-cart-quantity.dto';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CART')
@ApiBearerAuth('JWT-auth')
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Message('Cart retrieved successfully')
  @ApiOperation({
    summary: 'Get current cart',
    description:
      "Retrieves the authenticated user's cart with all items, including product details and line prices.",
  })
  @ApiOkResponse({
    type: ApiResponseDto<GetCartResponseDto>,
    description: 'Current cart with items',
  })
  @ApiNotFoundResponse({ description: 'Cart not found' })
  @ApiUnauthorizedResponse({ description: 'User is not authenticated' })
  getCart(@GetUser('id') userId: string): Promise<GetCartResponseDto> {
    return this.cartService.getCart(userId);
  }

  @Post('items/:productId')
  @Message('Item added to cart')
  @ApiOperation({
    summary: 'Add a product to the cart by product ID',
    description:
      'Adds a product (with optional variant) directly to the cart. If the item already exists, increments the quantity by 1.',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ID to add to cart',
  })
  @ApiQuery({
    name: 'variantId',
    required: false,
    description: 'Optional variant ID for product variants',
  })
  @ApiBody({ type: AddToCartQuantityDto })
  @ApiCreatedResponse({
    type: ApiResponseDto<AddToCartResponseDto>,
    description: 'Full cart with the newly added item',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiBadRequestResponse({ description: 'Invalid variant or quantity' })
  addToCart(
    @GetUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('variantId') variantId: string | undefined,
    @Body() dto: AddToCartQuantityDto,
  ): Promise<AddToCartResponseDto> {
    return this.cartService.addToCart(
      userId,
      productId,
      variantId,
      dto.addedFrom,
    );
  }

  @Patch('items/:productId')
  @Message('Cart item updated')
  @ApiOperation({
    summary: 'Update cart item quantity',
    description:
      'Increments (+1) or decrements (-1) the quantity of a cart item. If the result reaches 0 or below, the item is removed. Optionally pass variantId for product variants.',
  })
  @ApiParam({
    name: 'productId',
    description: 'Product ID to update quantity for',
  })
  @ApiQuery({
    name: 'variantId',
    required: false,
    description: 'Optional variant ID for product variants',
  })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiOkResponse({
    type: ApiResponseDto<UpdateCartItemResponseDto>,
    description: 'Cart with updated item quantity',
  })
  @ApiNotFoundResponse({ description: 'Cart item not found' })
  @ApiBadRequestResponse({
    description: 'Insufficient stock when incrementing, or invalid delta value',
  })
  updateItem(
    @GetUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('variantId') variantId: string | undefined,
    @Body() dto: UpdateCartItemDto,
  ): Promise<UpdateCartItemResponseDto> {
    return this.cartService.updateItem(userId, productId, variantId, dto);
  }

  @Delete('items/:productId')
  @HttpCode(HttpStatus.OK)
  @Message('Item removed from cart')
  @ApiOperation({
    summary: 'Remove item from cart',
    description:
      'Removes a specific item from the cart. Optionally pass variantId for product variants.',
  })
  @ApiParam({ name: 'productId', description: 'Product ID to remove' })
  @ApiQuery({
    name: 'variantId',
    required: false,
    description: 'Optional variant ID',
  })
  @ApiOkResponse({
    type: ApiResponseDto<RemoveCartItemResponseDto>,
    description: 'Cart with the item removed',
  })
  @ApiNotFoundResponse({ description: 'Cart item not found' })
  removeItem(
    @GetUser('id') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('variantId') variantId: string | undefined,
  ): Promise<RemoveCartItemResponseDto> {
    return this.cartService.removeItem(userId, productId, variantId);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @Message('Cart cleared successfully')
  @ApiOperation({
    summary: 'Clear all items from cart',
    description:
      "Removes all items from the authenticated user's cart, leaving it empty.",
  })
  @ApiOkResponse({
    type: ApiResponseDto<ClearCartResponseDto>,
    description: 'Empty cart',
  })
  @ApiNotFoundResponse({ description: 'Cart not found' })
  clearCart(@GetUser('id') userId: string): Promise<ClearCartResponseDto> {
    return this.cartService.clearCart(userId);
  }
}
