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
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProductsService } from 'src/modules/products/products.service';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { ROLE } from '@prisma/client';
import { AdminCreateProductDto } from 'src/modules/products/dto/admin-create-product.dto';
import { UpdateProductDto } from 'src/modules/products/dto/update-product.dto';
import { QueryProductDto } from 'src/modules/products/dto/query-product.dto';
import { AdminProductResponseDto } from 'src/modules/products/dto/admin-product-response.dto';
import { ProductResponseDto } from 'src/modules/products/dto/product-response.dto';
import { ProductReactivateResponseDto } from 'src/modules/products/dto/product-reactivate-response.dto';
import { UpdateStockDto } from 'src/modules/products/dto/update-stock.dto';
import { StockUpdateResponseDto } from 'src/modules/products/dto/stock-update-response.dto';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('ADMIN - PRODUCTS')
@ApiBearerAuth('JWT-auth')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // CREATE PRODUCT
  @Post()
  @Message('Product created successfully')
  @ApiOperation({
    summary: 'Create product',
    description: 'Create a new product with the provided details.',
  })
  @ApiBody({ type: AdminCreateProductDto })
  @ApiResponse({ status: 201, type: ApiResponseDto<AdminProductResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid input data.',
  })
  async create(
    @GetUser('id') adminId: string,
    @Body() dto: AdminCreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(dto, adminId);
  }

  @Get()
  @Message('Products retrieved successfully')
  @ApiOperation({
    summary: 'List products (admin, paginated)',
    description:
      'Paginated (page/limit, max 100). By default excludes soft-deleted products; pass isDeleted=true to include them. Pass isActive=true|false to filter active state. Storefront listings always hide deleted/inactive products.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  async findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAllForAdmin(query);
  }

  // GET BY ID (ADMIN ONLY)
  @Get(':id')
  @Message('Product retrieved successfully')
  @ApiOperation({
    summary: 'Get product by ID (admin)',
    description:
      'Returns any product by ID, including soft-deleted and inactive. Public category routes only expose active, non-deleted products.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<AdminProductResponseDto> })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminProductResponseDto> {
    return this.productsService.findOneForAdmin(id);
  }

  @Patch(':id/stock')
  @Message('Stock updated successfully')
  @ApiOperation({
    summary: 'Adjust product stock',
    description:
      'Update stock. Positive quantity to restock, negative to deduct. This is the only way to modify stock.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateStockDto })
  @ApiResponse({ status: 200, type: ApiResponseDto<StockUpdateResponseDto> })
  @ApiBadRequestResponse({
    description: 'Validation error or insufficient stock.',
  })
  async updateStock(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockDto,
  ): Promise<StockUpdateResponseDto> {
    return this.productsService.updateStock(
      id,
      dto.quantity,
      adminId,
      dto.description,
    );
  }

  @Patch(':id')
  @Message('Product updated successfully')
  @ApiOperation({
    summary: 'Update product fields',
    description: 'Stock is managed via the dedicated stock endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, type: ApiResponseDto<AdminProductResponseDto> })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  async update(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<AdminProductResponseDto> {
    return this.productsService.update(id, dto, adminId);
  }

  // DEACTIVATE PRODUCT
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Message('Product deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate product',
    description: 'Deactivate a product, removing it from public visibility.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  async deactivate(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.productsService.deactivate(id, adminId);
  }

  // REACTIVATE PRODUCT
  @Patch(':id/reactivate')
  @Message('Product reactivated successfully')
  @ApiOperation({
    summary: 'Reactivate product',
    description: 'Reactivate a previously deactivated product.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<ProductReactivateResponseDto>,
  })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  async reactivate(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductReactivateResponseDto> {
    return this.productsService.reactivate(id, adminId);
  }

  // DELETE PRODUCT
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Message('Product permanently deleted')
  @ApiOperation({
    summary: 'Permanently delete product',
    description: 'Permanently delete a product and all associated data.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  async remove(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.productsService.permanentRemove(id, adminId);
  }
}
