import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ROLE } from '@prisma/client';
import { CategoriesService } from 'src/modules/category/categories.service';
import { CreateCategoryDto } from 'src/modules/category/dto/create-category.dto';
import { UpdateCategoryDto } from 'src/modules/category/dto/update-category.dto';
import { CategoryResponseDto } from 'src/modules/category/dto/category-response.dto';
import { ParentsubcategoryResponseDto } from 'src/modules/category/dto/parentsubcategory-response.dto';
import { SubcategoryResponseDto } from 'src/modules/category/dto/subcategory-response.dto';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('ADMIN - CATEGORY')
@ApiBearerAuth('JWT-auth')
@Controller('admin/category')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminCategoryController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ─── READ ────────────────────────────────────────────────────────────────────

  @Get()
  @Message('Categories retrieved successfully')
  @ApiOperation({
    summary: 'Get full category tree including inactive nodes (admin)',
    description:
      'Returns the complete nested category hierarchy — active and inactive — ' +
      'so admins can see and manage all categories regardless of their visibility status.',
  })
  @ApiOkResponse({
    type: ApiResponseDto<CategoryResponseDto[]>,
    description: 'Full category tree returned (active + inactive).',
  })
  async getAdminTree(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.getAdminTree();
  }

  @Get(':slug')
  @Message('Category retrieved successfully')
  @ApiOperation({
    summary: 'Get a single category by slug including inactive (admin)',
    description:
      'Fetches a category with its full nested children by slug. ' +
      'Unlike the public endpoint, inactive categories are included.',
  })
  @ApiParam({
    name: 'slug',
    description: 'URL slug of the category to retrieve.',
  })
  @ApiOkResponse({
    type: ApiResponseDto<
      | CategoryResponseDto
      | ParentsubcategoryResponseDto
      | SubcategoryResponseDto
    >,
    description: 'Category found and returned.',
  })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  async findOne(
    @Param('slug') slug: string,
  ): Promise<
    CategoryResponseDto | ParentsubcategoryResponseDto | SubcategoryResponseDto
  > {
    return this.categoriesService.findBySlugAdmin(slug);
  }

  // ─── WRITE ───────────────────────────────────────────────────────────────────

  @Post()
  @Message('Category created successfully')
  @ApiOperation({
    summary: 'Create a new category',
    description:
      'Creates a top-level or nested category under an optional parent. ' +
      'The category type (Category, Parentsubcategory, or Subcategory) is ' +
      'automatically determined by the depth of the parent. A new category ' +
      'is created as active by default.',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({
    status: 201,
    type: ApiResponseDto<CategoryResponseDto>,
    description: 'Category created successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid input data.',
  })
  @ApiConflictResponse({
    description: 'Conflict — a category with this slug already exists.',
  })
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    return this.categoriesService.create(dto);
  }

  @Patch(':slug')
  @Message('Category updated successfully')
  @ApiOperation({
    summary: 'Update a category (no re-parenting allowed)',
    description:
      'Updates category metadata such as name, description, SEO title, ' +
      'SEO description, or image URL. Re-parenting is not supported — a ' +
      'category cannot be moved under a different parent.',
  })
  @ApiParam({
    name: 'slug',
    description: 'URL slug of the category to update.',
  })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<
      | CategoryResponseDto
      | ParentsubcategoryResponseDto
      | SubcategoryResponseDto
    >,
    description: 'Category updated successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid input data.',
  })
  @ApiNotFoundResponse({
    description: 'Category not found — no category matches the provided slug.',
  })
  @ApiConflictResponse({
    description: 'Conflict — the new slug is already taken.',
  })
  async update(
    @Param('slug') slug: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<
    CategoryResponseDto | ParentsubcategoryResponseDto | SubcategoryResponseDto
  > {
    return this.categoriesService.update(slug, dto);
  }

  @Patch(':slug/activate')
  @HttpCode(HttpStatus.OK)
  @Message('Category activated successfully')
  @ApiOperation({
    summary: 'Activate a category (cascades to all descendants)',
    description:
      'Activates a category by its slug and recursively activates all ' +
      'descendant categories. Inactive categories (and their children) are ' +
      'hidden from the public category tree and product browse pages.',
  })
  @ApiParam({
    name: 'slug',
    description: 'URL slug of the category to activate.',
  })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<null>,
    description: 'Category and all descendants activated.',
  })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  async activate(@Param('slug') slug: string): Promise<null> {
    await this.categoriesService.setActive(slug, true);
    return null;
  }

  @Patch(':slug/deactivate')
  @HttpCode(HttpStatus.OK)
  @Message('Category deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate a category (cascades to all descendants)',
    description:
      'Deactivates a category by its slug and recursively deactivates all ' +
      'descendant categories. Deactivated categories are hidden from the ' +
      'public category tree and will not appear in browse or filter results.',
  })
  @ApiParam({
    name: 'slug',
    description: 'URL slug of the category to deactivate.',
  })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<null>,
    description: 'Category and all descendants deactivated.',
  })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  async deactivate(@Param('slug') slug: string): Promise<null> {
    await this.categoriesService.setActive(slug, false);
    return null;
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  @Message('Category permanently deleted')
  @ApiOperation({
    summary: 'Permanently delete a category (leaf only, no products)',
    description:
      'Irreversibly deletes a leaf category (one with no children) that ' +
      'has no associated products. Categories that still have children or ' +
      'products attached cannot be deleted — deactivate them instead.',
  })
  @ApiParam({
    name: 'slug',
    description: 'URL slug of the leaf category to delete.',
  })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<null>,
    description: 'Category permanently deleted.',
  })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @ApiConflictResponse({
    description:
      'Conflict — category still has child categories or associated products.',
  })
  async remove(@Param('slug') slug: string): Promise<null> {
    await this.categoriesService.remove(slug);
    return null;
  }
}
