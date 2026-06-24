import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReviewResponseDto } from './dto/create-review.dto';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('REVIEWS')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a review for a purchased product',
    description:
      'Creates a review for a product the user has purchased. One review per product per user.',
  })
  @ApiBody({ type: CreateReviewDto })
  @ApiCreatedResponse({
    description: 'Review created successfully',
    type: ApiResponseDto<ReviewResponseDto>,
  })
  @ApiNotFoundResponse({ description: 'Product not found or not purchased' })
  @ApiConflictResponse({
    description: 'Review already exists for this product',
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @Message('Review submitted successfully')
  create(
    @GetUser('id') userId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.create(userId, dto);
  }

  @Get('product/:productId')
  @Public()
  @ApiOperation({
    summary: 'Get all active reviews for a product',
    description:
      'Returns all active (non-deleted) reviews for a given product, ordered by creation date.',
  })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiOkResponse({
    description: 'List of active reviews for the product',
    type: ApiResponseDto<ReviewResponseDto[]>,
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findByProduct(
    @Param('productId') productId: string,
  ): Promise<ReviewResponseDto[]> {
    return this.reviewsService.findByProduct(productId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete your own review',
    description:
      'Deletes a review belonging to the authenticated user. Users can only delete their own reviews.',
  })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Review deleted successfully',
  })
  @ApiNotFoundResponse({ description: 'Review not found' })
  @ApiForbiddenResponse({ description: 'Review does not belong to user' })
  @Message('Review deleted successfully')
  async remove(
    @GetUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<null> {
    await this.reviewsService.remove(userId, id);
    return null;
  }
}
