import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SearchService } from 'src/modules/shared/search/search.service';
import { QuerySearchDto } from './dto/query-search.dto';
import { SearchResponseDto, SearchResultDto } from './dto/search-result.dto';
import { CreatorJwtAuthGuard } from 'src/modules/creators/guards/creator-auth.guard';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiExtraModels(SearchResultDto, ApiResponseDto)
@ApiTags('CREATOR - SEARCH')
@ApiBearerAuth('JWT-auth')
@Controller('creators/search')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
export class CreatorSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Creator personalized global search across products, orders, and discount codes',
    description:
      'Search across your own products, orders, and discount codes. Requires Creator authentication.',
  })
  @ApiResponse({
    status: 200,
    schema: {
      allOf: [
        { $ref: getSchemaPath(ApiResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(SearchResultDto) },
            },
          },
        },
      ],
    },
  })
  async search(
    @GetCreator('id') creatorId: string,
    @Query() query: QuerySearchDto,
  ): Promise<SearchResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    return ((await this.searchService.searchCreatorGlobal(
      creatorId,
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
    summary: 'Creator autocomplete search suggestions',
    description:
      'Get autocomplete suggestions for creator dashboard search. Requires Creator authentication.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<SearchResponseDto> })
  async autocomplete(
    @GetCreator('id') creatorId: string,
    @Query() query: QuerySearchDto,
  ): Promise<SearchResponseDto> {
    const limit = query.limit ?? 10;
    const results = await this.searchService.autocompleteCreator(
      creatorId,
      query.query ?? '',
      query.types,
      limit,
    );
    return {
      results: results ?? [],
      pagination: {
        totalItems: results?.length ?? 0,
        page: 1,
        limit,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }
}
