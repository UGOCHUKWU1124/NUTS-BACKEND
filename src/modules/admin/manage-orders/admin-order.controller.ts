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
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ROLE } from '@prisma/client';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { OrdersService } from 'src/modules/orders/orders.service';
import { QueryOrderDto } from 'src/modules/orders/dto/query-order.dto';
import { UpdateOrderStatusDto } from 'src/modules/orders/dto/update-order-status.dto';
import { AdminOrderResponseDto } from 'src/modules/orders/dto/admin-order-response.dto';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@Roles(ROLE.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('ADMIN - ORDERS')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @Message('Orders retrieved successfully')
  @ApiOperation({
    summary: 'List all orders (admin, paginated)',
    description:
      'Filter by status, userId, date range, or search order number / customer email.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<AdminOrderResponseDto[]> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  findAll(@Query() query: QueryOrderDto) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get(':id')
  @Message('Order retrieved successfully')
  @ApiOperation({
    summary: 'Get order by ID with status history (admin)',
    description:
      'Retrieve a single order by its unique ID, including status history.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<AdminOrderResponseDto> })
  @ApiNotFoundResponse({ description: 'Order not found' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminOrderResponseDto> {
    return this.ordersService.findOneAdmin(id);
  }

  @Patch(':id/status')
  @Message('Order status updated successfully')
  @ApiOperation({
    summary: 'Update order status',
    description:
      'PENDING→PROCESSING|CANCELLED, PROCESSING→SHIPPED|CANCELLED, SHIPPED→DELIVERED. Cancelling restores stock once. Concurrent updates return 409.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiResponse({ status: 200, type: ApiResponseDto<AdminOrderResponseDto> })
  @ApiNotFoundResponse({ description: 'Order not found.' })
  @ApiConflictResponse({
    description:
      'Concurrent status change — the order was modified by another request.',
  })
  updateStatus(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<AdminOrderResponseDto> {
    return this.ordersService.updateStatusAdmin(
      id,
      dto.status,
      adminId,
      dto.note,
    );
  }
}
