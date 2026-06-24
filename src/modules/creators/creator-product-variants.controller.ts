import {
  BadRequestException,
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { CreatorVariantResponseDto } from 'src/modules/product-variants/dto/creator-variant-response.dto';
import { VariantStockUpdateResponseDto } from 'src/modules/product-variants/dto/variant-stock-update-response.dto';
import { ProductVariantListResponseDto } from 'src/modules/product-variants/dto/variant-response.dto';
import { QueryVariantDto } from 'src/modules/product-variants/dto/query-variant.dto';
import { CreatorJwtAuthGuard } from './guards/creator-auth.guard';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATOR - PRODUCT VARIANTS')
@Controller('creators/products/variants')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CreatorProductVariantsController {
  constructor(
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  @Get()
  @Message('Product variant(s) retrieved successfully')
  @ApiOperation({
    summary: 'Get variant(s) for your product',
    description:
      'Provide either productId to list variants for a product, or variantId to retrieve a single variant.',
  })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<
      CreatorVariantResponseDto | ProductVariantListResponseDto
    >,
  })
  @ApiBadRequestResponse({ description: 'Bad request - validation error' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async find(
    @GetCreator('id') creatorId: string,
    @Query() query: QueryVariantDto,
  ): Promise<CreatorVariantResponseDto | ProductVariantListResponseDto> {
    const { productId, variantId } = query;

    if (productId && variantId) {
      throw new BadRequestException(
        'Provide either productId or variantId, not both',
      );
    }

    if (variantId) {
      return this.productVariantsService.findOneForCreator(
        creatorId,
        variantId,
      );
    }

    if (productId) {
      return this.productVariantsService.findAllForCreator(
        creatorId,
        productId,
      );
    }

    throw new BadRequestException(
      'productId or variantId query parameter is required',
    );
  }

  @Post(':productId')
  @Message('Product variant created successfully')
  @ApiOperation({
    summary: 'Create a variant for your product',
    description: 'Add a new variant to one of your own products',
  })
  @ApiResponse({ status: 201, type: ApiResponseDto<CreatorVariantResponseDto> })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async create(
    @GetCreator('id') creatorId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateVariantDto,
  ): Promise<CreatorVariantResponseDto> {
    return this.productVariantsService.createForCreator(
      creatorId,
      productId,
      dto,
    );
  }

  @Patch(':id')
  @Message('Product variant updated successfully')
  @ApiOperation({
    summary: 'Update a product variant for your product',
    description: 'Update a variant that belongs to one of your products',
  })
  @ApiParam({ name: 'id', description: 'Variant ID' })
  @ApiBody({ type: UpdateVariantDto })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<CreatorVariantResponseDto>,
    description: 'Updated variant',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Variant not found' })
  async update(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantDto,
  ): Promise<CreatorVariantResponseDto> {
    return this.productVariantsService.updateForCreator(creatorId, id, dto);
  }

  @Patch(':id/deactivate')
  @Message('Product variant deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate a product variant for your product',
    description: 'Disable a variant that belongs to one of your products',
  })
  @ApiParam({ name: 'id', description: 'Variant ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorVariantResponseDto> })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Variant not found' })
  async deactivate(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CreatorVariantResponseDto> {
    return this.productVariantsService.deactivateForCreator(creatorId, id);
  }

  @Patch(':id/reactivate')
  @Message('Product variant reactivated successfully')
  @ApiOperation({
    summary: 'Reactivate a product variant for your product',
    description: 'Restore a previously deactivated or soft deleted variant',
  })
  @ApiParam({ name: 'id', description: 'Variant ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorVariantResponseDto> })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Variant not found' })
  async reactivate(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CreatorVariantResponseDto> {
    return this.productVariantsService.reactivateForCreator(creatorId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Message('Product variant permanently deleted successfully')
  @ApiOperation({
    summary: 'Permanently delete a product variant for your product',
    description:
      'Permanently remove a variant that belongs to one of your products',
  })
  @ApiParam({ name: 'id', description: 'Variant ID' })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Variant permanently deleted',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiNotFoundResponse({ description: 'Variant not found' })
  async delete(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    await this.productVariantsService.permanentRemoveForCreator(creatorId, id);
    return null;
  }

  @Patch(':id/stock')
  @Message('Product variant stock updated successfully')
  @ApiOperation({
    summary: 'Adjust stock for your product variant',
    description:
      "Apply a delta adjustment to one of your product variants' stock quantity. " +
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
  @ApiForbiddenResponse({ description: 'You do not own this variant' })
  @ApiNotFoundResponse({ description: 'Variant not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async updateStock(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVariantStockDto,
  ): Promise<VariantStockUpdateResponseDto> {
    return this.productVariantsService.updateStockForCreator(
      creatorId,
      id,
      dto.quantity,
      dto.description,
    );
  }
}
