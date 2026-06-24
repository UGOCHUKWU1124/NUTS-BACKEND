import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ModerateThrottle } from 'src/modules/shared/decorators/custom-throttler.decorator';

import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import type { Request } from 'express';

import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';
import { PublicProductResponseDto } from './dto/public-product-response.dto';

import { Message } from 'src/modules/shared/decorators/message.decorator';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import type { RequestWithUser } from 'src/modules/shared/interfaces/request-with-user.interface';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('PRODUCTS')
@Public()
@Controller('products')
export class ProductController {
  constructor(private readonly productsService: ProductsService) {}

  // LIST ALL PRODUCTS

  @ModerateThrottle()
  @Get()
  @Message('Products retrieved successfully')
  @ApiOperation({
    summary: 'List and search products',
    description:
      'Returns a paginated list of active, non-deleted products. Supports search, category filter, price range, and stock filter.',
  })
  @ApiQuery({ type: QueryProductDto })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search term for product name/description',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    description: 'Minimum price filter',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    description: 'Maximum price filter',
  })
  @ApiQuery({
    name: 'inStock',
    required: false,
    description: 'Filter by stock availability (true/false)',
  })
  @ApiOkResponse({
    type: ApiResponseDto<PublicProductResponseDto[]>,
    description:
      'Paginated list of active products. Response shape: { data: PublicProductResponseDto[], meta: { total, page, limit, totalPages } }',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  async findAll(
    @Query() query: QueryProductDto,
    @Req() req: Request,
  ): Promise<{
    data: PublicProductResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const bypassCache =
      req.headers['x-cache-bypass'] === 'true' &&
      (req as RequestWithUser).user?.role === 'ADMIN';
    return this.productsService.findAllPublic({ ...query, bypassCache });
  }

  // GET SINGLE PRODUCT BY SLUG

  @ModerateThrottle()
  @Get(':slug')
  @Message('Product retrieved successfully')
  @ApiOperation({
    summary: 'Get product by slug',
    description: 'Example: /products/nike-air-max',
  })
  @ApiParam({ name: 'slug', description: 'Product slug (e.g., nike-air-max)' })
  @ApiOkResponse({
    type: ApiResponseDto<PublicProductResponseDto>,
    description: 'Product details',
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  async findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<PublicProductResponseDto> {
    const bypassCache =
      req.headers['x-cache-bypass'] === 'true' &&
      (req as RequestWithUser).user?.role === 'ADMIN';
    return this.productsService.findOnePublic(slug, bypassCache);
  }
}
