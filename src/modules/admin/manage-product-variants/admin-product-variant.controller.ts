import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProductVariantsService } from 'src/modules/product-variants/product-variants.service';
import { CreateVariantDto } from 'src/modules/product-variants/dto/create-variant.dto';
import { UpdateVariantDto } from 'src/modules/product-variants/dto/update-variant.dto';
import { UpdateVariantStockDto } from 'src/modules/product-variants/dto/update-variant-stock.dto';
import { AdminVariantResponseDto } from 'src/modules/product-variants/dto/admin-variant-response.dto';
import { VariantStockUpdateResponseDto } from 'src/modules/product-variants/dto/variant-stock-update-response.dto';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { ROLE } from '@prisma/client';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('ADMIN - PRODUCT VARIANTS')
@ApiBearerAuth('JWT-auth')
@Controller('admin/products/variants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminProductVariantsController {
  constructor(
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  @Post(':productId')
  @Message('Product variant created successfully')
  @ApiOperation({ summary: 'Create a variant for a product (Admin)' })
  @ApiResponse({ status: 201, type: ApiResponseDto<AdminVariantResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  async create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateVariantDto,
  ): Promise<AdminVariantResponseDto> {
    return this.productVariantsService.create(productId, dto);
  }

  @Patch(':id')
  @Message('Product variant updated successfully')
  @ApiOperation({ summary: 'Update a product variant (Admin)' })
  @ApiResponse({ status: 200, type: ApiResponseDto<AdminVariantResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
  ): Promise<AdminVariantResponseDto> {
    return this.productVariantsService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @Message('Product variant deactivated successfully')
  @ApiOperation({ summary: 'Deactivate a product variant (Admin)' })
  @ApiParam({ name: 'id', description: 'Variant ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<AdminVariantResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminVariantResponseDto> {
    return this.productVariantsService.deactivate(id);
  }

  @Patch(':id/reactivate')
  @Message('Product variant reactivated successfully')
  @ApiOperation({ summary: 'Reactivate a product variant (Admin)' })
  @ApiParam({ name: 'id', description: 'Variant ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<AdminVariantResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  async reactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminVariantResponseDto> {
    return this.productVariantsService.reactivate(id);
  }

  @Patch(':id/stock')
  @Message('Product variant stock updated successfully')
  @ApiOperation({
    summary: 'Adjust stock for a product variant',
    description:
      "Apply a delta adjustment to a variant's stock quantity. " +
      'Use a positive integer to add stock, a negative integer to subtract. ' +
      'Returns the updated stock level along with its availability status.',
  })
  @ApiParam({ name: 'id', description: 'Variant ID' })
  @ApiBody({ type: UpdateVariantStockDto })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<VariantStockUpdateResponseDto>,
    description: 'Stock updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient stock or invalid quantity',
  })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  async updateStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantStockDto,
  ): Promise<VariantStockUpdateResponseDto> {
    return this.productVariantsService.updateStock(
      id,
      dto.quantity,
      dto.description,
    );
  }

  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @Message('Product variant permanently deleted successfully')
  @ApiOperation({ summary: 'Permanently delete a product variant (Admin)' })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Product variant permanently deleted successfully',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.productVariantsService.permanentRemove(id);
    return null;
  }
}
