import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductVariantsService } from './product-variants.service';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { PublicVariantResponseDto } from './dto/public-variant-response.dto';
import {
  ProductVariantListResponseDto,
  AllVariantsResponseDto,
} from './dto/variant-response.dto';
import { QueryVariantDto } from './dto/query-variant.dto';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('PRODUCT VARIANTS')
@Public()
@Controller('variants')
export class ProductVariantsController {
  constructor(private readonly service: ProductVariantsService) {}

  // PUBLIC: GET ALL VARIANTS (paginated) or by productId/variantId
  @Get()
  @Message('Product variants retrieved successfully')
  @ApiOperation({
    summary: 'Retrieve all variants (paginated), by productId, or by variantId',
    description:
      'Returns paginated all variants when no params, a list when productId is provided, or a single variant when variantId is provided.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns paginated all variants when no params, list when productId provided, or a single variant when variantId provided.',
  })
  @ApiResponse({
    status: 400,
    description: 'Provide exactly one of productId or variantId',
  })
  async find(
    @Query() query: QueryVariantDto,
  ): Promise<
    | AllVariantsResponseDto
    | ProductVariantListResponseDto
    | PublicVariantResponseDto
  > {
    const { productId, variantId, page, limit } = query;

    // If no specific filter, return all variants (paginated)
    if (!productId && !variantId) {
      return this.service.findAllPaginated({ page, limit });
    }

    if (!!productId === !!variantId) {
      throw new BadRequestException(
        'Provide exactly one of productId or variantId as a query parameter.',
      );
    }

    if (variantId) {
      return this.service.findOne(variantId);
    }

    if (productId) {
      return this.service.findAll(productId);
    }

    throw new BadRequestException(
      'Provide exactly one of productId or variantId as a query parameter.',
    );
  }

  // PUBLIC: GET SINGLE VARIANT BY ID
  @Get(':id')
  @Message('Variant retrieved successfully')
  @ApiOperation({
    summary: 'Get a single variant by ID',
    description: 'Retrieves a specific product variant by its unique ID.',
  })
  @ApiParam({ name: 'id', description: 'Variant ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<PublicVariantResponseDto> })
  @ApiResponse({ status: 404, description: 'Variant not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicVariantResponseDto> {
    return this.service.findOne(id);
  }
}
