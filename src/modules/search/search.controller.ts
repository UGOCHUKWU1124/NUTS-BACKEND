import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SearchService } from 'src/modules/shared/search/search.service';
import { QuerySearchDto } from './dto/query-search.dto';
import { SearchResponseDto, SearchResultDto } from './dto/search-result.dto';
import { SearchProductsResponseDto } from './dto/search-products-response.dto';
import { SearchProductHitDto } from './dto/search-product-hit.dto';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiExtraModels(SearchResultDto, SearchProductHitDto, ApiResponseDto)
@ApiTags('SEARCH')
@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Global search: marketplace results by default, or rich storefront product results when types=products',
    description:
      'Search products and other entities in the marketplace. Pass types=products for detailed storefront product results with variants and images.',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        {
          $ref: getSchemaPath(ApiResponseDto),
        },
        {
          properties: {
            data: {
              oneOf: [
                {
                  type: 'array',
                  items: { $ref: getSchemaPath(SearchResultDto) },
                },
                {
                  type: 'array',
                  items: { $ref: getSchemaPath(SearchProductHitDto) },
                },
              ],
            },
          },
        },
      ],
    },
  })
  async search(
    @Query() query: QuerySearchDto,
  ): Promise<SearchResponseDto | SearchProductsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const types = query.types;
    const onlyProducts = types?.length === 1 && types[0] === 'products';

    if (onlyProducts) {
      const result = (await this.searchService.searchProductsWithDetails(
        query.query ?? '',
        page,
        limit,
      )) ?? {
        hits: [],
        pagination: {
          totalItems: 0,
          page,
          limit,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      return {
        results: result.hits,
        pagination: result.pagination,
      } as SearchProductsResponseDto;
    }

    return ((await this.searchService.searchMarketplace(
      query.query ?? '',
      query.types,
      page,
      limit,
    )) ?? {
      results: [],
      pagination: {
        totalItems: 0,
        page,
        limit,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }) as SearchResponseDto;
  }

  @Get('autocomplete')
  @ApiOperation({
    summary: 'Autocomplete suggestions for marketplace search',
    description:
      'Get autocomplete search suggestions for the marketplace search bar.',
  })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  @ApiResponse({ status: 200, type: ApiResponseDto<SearchResponseDto> })
  async autocomplete(
    @Query() query: QuerySearchDto,
  ): Promise<SearchResponseDto> {
    const results = await this.searchService.autocomplete(
      query.query ?? '',
      query.types,
      query.limit ?? 10,
    );
    return {
      results: results ?? [],
      pagination: {
        totalItems: results?.length ?? 0,
        page: 1,
        limit: query.limit ?? 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }
}
