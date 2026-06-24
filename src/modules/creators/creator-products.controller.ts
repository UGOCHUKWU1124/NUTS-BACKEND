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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ProductsService } from 'src/modules/products/products.service';
import { CreatorJwtAuthGuard } from './guards/creator-auth.guard';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import { CreateProductDto } from 'src/modules/products/dto/create-product.dto';
import { UpdateProductDto } from 'src/modules/products/dto/update-product.dto';
import { QueryProductDto } from 'src/modules/products/dto/query-product.dto';
import { CreatorProductResponseDto } from 'src/modules/products/dto/creator-product-response.dto';
import { ProductReactivateResponseDto } from 'src/modules/products/dto/product-reactivate-response.dto';
import { UpdateStockDto } from 'src/modules/products/dto/update-stock.dto';
import { StockUpdateResponseDto } from 'src/modules/products/dto/stock-update-response.dto';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ApiResponseDto,
  PaginationMetaDto,
} from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATOR - PRODUCTS')
@ApiBearerAuth('JWT-auth')
@Controller('creators/products')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
export class CreatorProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────────────────────────────────
  // CREATE PRODUCT
  // ─────────────────────────────────────
  @Post()
  @Message('Product created successfully')
  @ApiOperation({
    summary: 'Create product (creator)',
    description:
      'Create a new product for your store under a specific category',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description:
      'Optional Category UUID to assign the product to. Defaults to uncategorized if omitted.',
  })
  @ApiBody({ type: CreateProductDto })
  @ApiCreatedResponse({
    type: ApiResponseDto<CreatorProductResponseDto>,
    description: 'Product created',
  })
  @ApiBadRequestResponse({ description: 'Bad request - validation error' })
  @ApiConflictResponse({
    description: 'Conflict - product slug already exists',
  })
  async create(
    @GetCreator('id') creatorId: string,
    @Body() dto: CreateProductDto,
    @Query('categoryId', new ParseUUIDPipe({ optional: true }))
    categoryId?: string,
  ): Promise<CreatorProductResponseDto> {
    if (categoryId) {
      dto.categoryId = categoryId;
    }
    return this.productsService.createForCreator(creatorId, dto);
  }

  // ─────────────────────────────────────
  // LIST CREATOR PRODUCTS
  // ─────────────────────────────────────
  @Get()
  @Message('Products retrieved successfully')
  @ApiOperation({
    summary: 'List your products (creator)',
    description: 'Paginated list of your products (page/limit, max 100)',
  })
  @ApiOkResponse({
    type: ApiResponseDto<CreatorProductResponseDto[]>,
    description: 'Paginated list of your products',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAll(
    @GetCreator('id') creatorId: string,
    @Query() query: QueryProductDto,
  ): Promise<{ data: CreatorProductResponseDto[]; meta: PaginationMetaDto }> {
    return this.productsService.findAllForCreator(creatorId, query);
  }

  // ─────────────────────────────────────
  // GET SINGLE PRODUCT BY SLUG
  // ─────────────────────────────────────
  @Get(':slug')
  @Message('Product retrieved successfully')
  @ApiOperation({
    summary: 'Get your product by slug (creator)',
    description: 'Retrieve one of your products by its slug',
  })
  @ApiParam({ name: 'slug', description: 'Product slug' })
  @ApiOkResponse({
    type: ApiResponseDto<CreatorProductResponseDto>,
    description: 'Product details',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async findBySlug(
    @GetCreator('id') creatorId: string,
    @Param('slug') slug: string,
  ): Promise<CreatorProductResponseDto> {
    return this.productsService.findOneForCreator(slug, creatorId);
  }

  // ─────────────────────────────────────
  // UPDATE PRODUCT
  // ─────────────────────────────────────
  @Patch(':id')
  @Message('Product updated successfully')
  @ApiOperation({
    summary: 'Update product (creator)',
    description:
      'Update product fields. Stock is managed via the dedicated stock endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<CreatorProductResponseDto>,
    description: 'Updated product',
  })
  @ApiBadRequestResponse({ description: 'Bad request - validation error' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  @ApiConflictResponse({ description: 'Conflict - duplicate slug' })
  async update(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<CreatorProductResponseDto> {
    await this.assertProductOwnership(creatorId, id);
    const result = await this.productsService.update(id, dto, creatorId);
    // Cast admin response to creator response (safe since creatorId verified ownership)
    return result;
  }

  // ─────────────────────────────────────
  // UPDATE STOCK
  // ─────────────────────────────────────
  @Patch(':id/stock')
  @Message('Stock updated successfully')
  @ApiOperation({
    summary: 'Adjust product stock (creator)',
    description:
      'Update stock. Positive quantity to restock, negative to deduct. This is the only way to modify stock.',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateStockDto })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<StockUpdateResponseDto>,
    description: 'Updated stock',
  })
  @ApiBadRequestResponse({ description: 'Bad request - validation error' })
  async updateStock(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStockDto,
  ): Promise<StockUpdateResponseDto> {
    await this.assertProductOwnership(creatorId, id);
    return this.productsService.updateStock(
      id,
      dto.quantity,
      undefined,
      dto.description,
    );
  }

  // ─────────────────────────────────────
  // DEACTIVATE PRODUCT
  // ─────────────────────────────────────
  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Message('Product deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate product (creator)',
    description: 'Hide product from storefront but keep in database',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<null>,
    description: 'Deactivated product',
  })
  @ApiForbiddenResponse({ description: 'Forbidden - not your product' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async deactivate(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    await this.assertProductOwnership(creatorId, id);
    await this.productsService.deactivate(id);
    return null;
  }

  // ─────────────────────────────────────
  // REACTIVATE PRODUCT
  // ─────────────────────────────────────
  @Patch(':id/reactivate')
  @Message('Product reactivated successfully')
  @ApiOperation({
    summary: 'Reactivate product (creator)',
    description: 'Show product on storefront',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<ProductReactivateResponseDto>,
    description: 'Reactivated product',
  })
  @ApiForbiddenResponse({ description: 'Forbidden - not your product' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async reactivate(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductReactivateResponseDto> {
    await this.assertProductOwnership(creatorId, id);
    return this.productsService.reactivate(id);
  }

  // ─────────────────────────────────────
  // PERMANENT DELETE PRODUCT
  // ─────────────────────────────────────
  @Delete(':id/permanent')
  @HttpCode(HttpStatus.OK)
  @Message('Product permanently deleted')
  @ApiOperation({
    summary: 'Permanently delete product (creator)',
    description: 'Irreversibly remove a product from the database',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Product permanently deleted',
  })
  @ApiForbiddenResponse({ description: 'Forbidden - not your product' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async permanentRemove(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    await this.assertProductOwnership(creatorId, id);
    await this.productsService.permanentRemove(id);
    return null;
  }

  // ─────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────
  private async assertProductOwnership(
    creatorId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { creatorId: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.creatorId !== creatorId) {
      throw new ForbiddenException(
        'You do not have permission to manage this product',
      );
    }
  }
}
