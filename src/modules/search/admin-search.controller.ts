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
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { ROLE } from '@prisma/client';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiExtraModels(SearchResultDto, ApiResponseDto)
@ApiTags('ADMIN - SEARCH')
@ApiBearerAuth('JWT-auth')
@Controller('admin/search')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Admin global search across users, creators, products, orders, and discount codes',
    description:
      'Search across all entities in the system. Requires ADMIN role.',
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
  async search(@Query() query: QuerySearchDto): Promise<SearchResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return ((await this.searchService.searchAdminGlobal(
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
    summary: 'Admin autocomplete search suggestions',
    description:
      'Get autocomplete suggestions for admin search. Requires ADMIN role.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<SearchResponseDto> })
  async autocomplete(
    @Query() query: QuerySearchDto,
  ): Promise<SearchResponseDto> {
    const limit = query.limit ?? 10;
    const results = await this.searchService.autocomplete(
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
