import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto, WishlistResponseDto } from './dto/wishlist.dto';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('WISHLIST')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post()
  @ApiOperation({
    summary: 'Add a product or variant to your wishlist',
    description:
      'Add a product (and optionally a specific variant) to the wishlist.',
  })
  @ApiBody({ type: AddToWishlistDto })
  @ApiCreatedResponse({
    description: 'Item added to wishlist',
    type: ApiResponseDto<WishlistResponseDto>,
  })
  @ApiConflictResponse({ description: 'Item already in wishlist' })
  @Message('Item added to wishlist')
  add(
    @GetUser('id') userId: string,
    @Body() dto: AddToWishlistDto,
  ): Promise<WishlistResponseDto> {
    return this.wishlistService.add(userId, dto.productId, dto.variantId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get your wishlist',
    description: 'Retrieve all items in the authenticated user wishlist.',
  })
  @ApiOkResponse({
    description: 'List of wishlist items',
    type: ApiResponseDto<WishlistResponseDto[]>,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findMine(@GetUser('id') userId: string): Promise<WishlistResponseDto[]> {
    return this.wishlistService.findMine(userId);
  }

  @Delete(':productId')
  @ApiOperation({
    summary: 'Remove a product/variant from your wishlist',
    description:
      'Remove a product (and optionally a specific variant) from the wishlist.',
  })
  @ApiParam({ name: 'productId', description: 'Product ID to remove' })
  @ApiQuery({
    name: 'variantId',
    required: false,
    description: 'Optional variant ID',
  })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Item removed from wishlist',
  })
  @ApiNotFoundResponse({ description: 'Wishlist item not found' })
  @Message('Item removed from wishlist')
  async remove(
    @GetUser('id') userId: string,
    @Param('productId') productId: string,
    @Query('variantId') variantId?: string,
  ): Promise<null> {
    await this.wishlistService.remove(userId, productId, variantId);
    return null;
  }
}
