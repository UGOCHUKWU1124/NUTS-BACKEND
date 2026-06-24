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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import { CreatorJwtAuthGuard } from './guards/creator-auth.guard';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { DiscountCodeService } from 'src/modules/promotions/discount-code.service';
import { CreateCreatorDiscountCodeDto } from 'src/modules/promotions/dto/create-creator-discount-code.dto';
import { DiscountCodeResponseDto } from 'src/modules/promotions/dto/discount-code-response.dto';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATOR - DISCOUNT CODES')
@Controller('creators/discounts')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CreatorDiscountCodesController {
  constructor(private readonly discountCodeService: DiscountCodeService) {}

  @Post()
  @Message('Discount code created successfully')
  @ApiOperation({
    summary: 'Create a discount code for your products',
    description:
      'Create a new discount code for your products. Optionally restrict to specific products.',
  })
  @ApiBody({ type: CreateCreatorDiscountCodeDto })
  @ApiResponse({ status: 201, type: ApiResponseDto<DiscountCodeResponseDto> })
  @ApiBadRequestResponse({ description: 'Bad request - validation error' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async create(
    @GetCreator('id') creatorId: string,
    @Body() dto: CreateCreatorDiscountCodeDto,
  ): Promise<DiscountCodeResponseDto> {
    return this.discountCodeService.createForCreator(creatorId, dto);
  }

  @Get()
  @Message('Discount codes retrieved successfully')
  @ApiOperation({
    summary: 'List your discount codes',
    description: 'Get all discount codes created by the authenticated creator.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<DiscountCodeResponseDto[]> })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAll(
    @GetCreator('id') creatorId: string,
  ): Promise<DiscountCodeResponseDto[]> {
    return this.discountCodeService.findAllForCreator(creatorId);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Message('Discount code deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate a discount code',
    description: 'Deactivate one of your discount codes.',
  })
  @ApiParam({ name: 'id', description: 'Discount code ID' })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<null>,
    description: 'Discount code deactivated',
  })
  @ApiNotFoundResponse({ description: 'Discount code not found' })
  async deactivate(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    await this.discountCodeService.deactivate(id, creatorId, false);
    return null;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Message('Discount code deleted successfully')
  @ApiOperation({
    summary: 'Delete a discount code',
    description:
      'Permanently delete a discount code. Cannot delete if it has been used.',
  })
  @ApiParam({ name: 'id', description: 'Discount code ID' })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<null>,
    description: 'Discount code deleted',
  })
  @ApiBadRequestResponse({ description: 'Cannot delete used discount code' })
  @ApiNotFoundResponse({ description: 'Discount code not found' })
  async remove(
    @GetCreator('id') creatorId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    await this.discountCodeService.remove(id, creatorId, false);
    return null;
  }
}
