import { Controller, Get, Param, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CategoriesService } from './categories.service';
import type { RequestWithUser } from 'src/modules/shared/interfaces/request-with-user.interface';
import { CategoryResponseDto } from './dto/category-response.dto';
import { ParentsubcategoryResponseDto } from './dto/parentsubcategory-response.dto';
import { SubcategoryResponseDto } from './dto/subcategory-response.dto';
import { ProductResponseDto } from 'src/modules/products/dto/product-response.dto';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CATEGORIES')
@Public()
@Controller('category')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @Message('Category retrieved successfully')
  @ApiOperation({
    summary: 'Get full nested category tree (public)',
    description:
      'Retrieve the complete category hierarchy with all parent, sub, and child categories',
  })
  @ApiOkResponse({
    type: ApiResponseDto<CategoryResponseDto[]>,
  })
  async getTree(@Req() req: Request): Promise<CategoryResponseDto[]> {
    const bypassCache =
      req.headers['x-cache-bypass'] === 'true' &&
      (req as RequestWithUser).user?.role === 'ADMIN';
    return this.categoriesService.getTree(bypassCache);
  }

  @Get('*path')
  @Message('Resource retrieved successfully')
  @ApiOperation({
    summary:
      'Find a category or product by path (e.g. fashion/womenswear or fashion/womenswear/bubus-and-dresses/yellow-bubu-gown)',
    description:
      'Resolve a slug path to a category or product. All-slug paths resolve to categories; if the last segment is a product slug under a leaf subcategory, the product is returned instead.',
  })
  @ApiParam({
    name: 'path',
    description:
      'Slug path — resolves to a category if all segments are valid category slugs, or to a product if the last segment is a product slug under a leaf subcategory',
  })
  @ApiNotFoundResponse({ description: 'Path not found' })
  @ApiBadRequestResponse({ description: 'Invalid path parameter' })
  @ApiOkResponse({
    type: ApiResponseDto<
      | CategoryResponseDto
      | ParentsubcategoryResponseDto
      | SubcategoryResponseDto
      | ProductResponseDto
    >,
    description: 'Resource retrieved successfully',
  })
  async findByPath(
    @Param('path') path: string,
  ): Promise<
    | CategoryResponseDto
    | ParentsubcategoryResponseDto
    | SubcategoryResponseDto
    | ProductResponseDto
  > {
    return this.categoriesService.findByPath(path);
  }
}
