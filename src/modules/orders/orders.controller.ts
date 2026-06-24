import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
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
import { PaginationQueryDto } from 'src/modules/shared/dto/pagination-query.dto';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CheckoutResponseDto } from './dto/checkout-response.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { UpdateOrderShippingDto } from './dto/update-order-shipping.dto';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('ORDERS')
@ApiBearerAuth('JWT-auth')
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.CREATED)
  @Message('Order placed successfully')
  @ApiOperation({
    summary: 'Checkout cart and create order',
    description:
      'Provide either an addressId query param for a saved address, or a shippingAddress object in the body. These are mutually exclusive.',
  })
  @ApiQuery({
    name: 'addressId',
    required: false,
    description:
      'UUID of a saved shipping address. Mutually exclusive with inline shippingAddress in the body.',
  })
  @ApiBody({ type: CheckoutDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Unique key per checkout attempt. Duplicate requests with the same key within 24 hours return the original order without creating a new one.',
  })
  @ApiCreatedResponse({
    type: ApiResponseDto<CheckoutResponseDto>,
    description: 'Order created successfully with order details and summary',
  })
  @ApiBadRequestResponse({ description: 'Validation error or cart empty' })
  @ApiNotFoundResponse({ description: 'Cart or product not found' })
  @ApiConflictResponse({
    description: 'Price mismatch or idempotency conflict',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication' })
  checkout(
    @GetUser('id') userId: string,
    @Query('addressId') addressId: string | undefined,
    @Body() dto: CheckoutDto,
    @Headers('Idempotency-Key') idempotencyKey: string,
  ): Promise<CheckoutResponseDto> {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.ordersService.checkout(userId, dto, addressId, idempotencyKey);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Message('Order cancelled successfully')
  @ApiOperation({
    summary: 'Cancel a pending order',
    description:
      'Only PENDING orders can be cancelled. Stock is restored automatically.',
  })
  @ApiParam({ name: 'id', description: 'Order ID to cancel' })
  @ApiOkResponse({
    type: ApiResponseDto<OrderResponseDto>,
    description: 'Cancelled order',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({ description: 'Order is not in PENDING status' })
  cancelMine(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelMine(userId, id);
  }

  @Patch(':id/shipping')
  @Message('Shipping address updated successfully')
  @ApiOperation({
    summary: 'Update shipping address on your order',
    description:
      'Only the order owner can update shipping. Not allowed on cancelled or delivered orders.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: UpdateOrderShippingDto })
  @ApiOkResponse({
    type: ApiResponseDto<OrderResponseDto>,
    description: 'Order with updated shipping',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiBadRequestResponse({
    description: 'Order cannot be updated in current status',
  })
  updateShipping(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderShippingDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateShippingMine(
      userId,
      id,
      dto.shippingAddress,
    );
  }

  @Get()
  @Message('Orders retrieved successfully')
  @ApiOperation({
    summary: 'List my orders',
    description:
      'Returns a paginated list of orders belonging to the authenticated user, ordered by creation date descending.',
  })
  @ApiQuery({ type: PaginationQueryDto })
  @ApiOkResponse({
    type: ApiResponseDto<OrderResponseDto[]>,
    description: 'Paginated list of user orders',
  })
  @ApiNotFoundResponse({ description: 'No orders found' })
  findMine(
    @GetUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<{
    data: OrderResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.ordersService.findMine(userId, query);
  }

  @Get(':id')
  @Message('Order retrieved successfully')
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Retrieves a single order belonging to the authenticated user by its ID.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({
    type: ApiResponseDto<OrderResponseDto>,
    description: 'Order details',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiForbiddenResponse({ description: 'Order does not belong to user' })
  findOne(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.findOne(userId, id);
  }
}
