import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrdersService } from 'src/modules/orders/orders.service';
import { CreatorOrderResponseDto } from 'src/modules/orders/dto/creator-order-response.dto';
import { UpdateOrderStatusDto } from 'src/modules/orders/dto/update-order-status.dto';
import { CreatorJwtAuthGuard } from './guards/creator-auth.guard';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATOR - ORDERS')
@Controller('creators/orders')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CreatorOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Message('Orders retrieved successfully')
  @ApiOperation({
    summary: 'List orders containing your products (creator)',
    description:
      'Paginated list of orders that include your products. Filter by status, date range.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by order status',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO 8601)',
  })
  @ApiOkResponse({
    type: ApiResponseDto<CreatorOrderResponseDto[]>,
    description: 'Paginated list of orders containing your products',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAll(
    @GetCreator('id') creatorId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.ordersService.findAllForCreator(creatorId, {
      page,
      limit,
      status,
      fromDate,
      toDate,
    });
  }

  @Get(':id')
  @Message('Order retrieved successfully')
  @ApiOperation({
    summary: 'Get order details (creator)',
    description: 'View details of an order containing your products',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiOkResponse({
    type: CreatorOrderResponseDto,
    description: 'Order details with your product line items',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  async findOne(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOneForCreator(creatorId, id);
  }

  @Patch(':id/status')
  @Message('Order status updated successfully')
  @ApiOperation({
    summary: 'Update order status for a fulfillment action',
    description:
      'Advance the fulfillment status of an order that contains your products.\n\n' +
      '**Allowed transitions:**\n' +
      '- `PROCESSING` → `SHIPPED` — when you have shipped the items\n' +
      '- `SHIPPED` → `DELIVERED` — when the customer has received the items\n\n' +
      'Use the `note` field to record a reason, tracking number, or any other context.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiOkResponse({
    type: CreatorOrderResponseDto,
    description: 'Order status updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid transition or you do not own any items in this order',
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  @ApiConflictResponse({
    description: 'Order was modified by another request; retry',
  })
  async updateStatus(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<CreatorOrderResponseDto> {
    return this.ordersService.updateStatusForCreator(
      creatorId,
      id,
      dto.status,
      dto.note,
    );
  }
}
