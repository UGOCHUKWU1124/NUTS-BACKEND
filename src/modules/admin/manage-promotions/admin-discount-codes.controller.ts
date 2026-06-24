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
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ROLE } from '@prisma/client';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { DiscountCodeService } from 'src/modules/promotions/discount-code.service';
import { CreateAdminDiscountCodeDto } from 'src/modules/promotions/dto/create-admin-discount-code.dto';
import { DiscountCodeResponseDto } from 'src/modules/promotions/dto/discount-code-response.dto';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('ADMIN - DISCOUNT CODES')
@Controller('admin/discounts')
@Roles(ROLE.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AdminDiscountCodesController {
  constructor(private readonly discountCodeService: DiscountCodeService) {}

  @Post()
  @Message('Discount code created successfully')
  @ApiOperation({
    summary: 'Create a discount code (admin)',
    description:
      'Creates a platform-wide discount code that applies to every product regardless of creator or category.',
  })
  @ApiBody({ type: CreateAdminDiscountCodeDto })
  @ApiResponse({ status: 201, type: ApiResponseDto<DiscountCodeResponseDto> })
  @ApiBadRequestResponse({ description: 'Bad request - validation error' })
  async create(
    @Body() dto: CreateAdminDiscountCodeDto,
  ): Promise<DiscountCodeResponseDto> {
    return this.discountCodeService.createForAdmin(dto);
  }

  @Get()
  @Message('Discount codes retrieved successfully')
  @ApiOperation({
    summary: 'List all discount codes (admin)',
    description: 'Retrieve a list of all discount codes with usage counts.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<DiscountCodeResponseDto[]> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  async findAll(): Promise<DiscountCodeResponseDto[]> {
    return this.discountCodeService.findAllForAdmin();
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @Message('Discount code deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate a discount code',
    description: 'Set a discount code as inactive so it can no longer be used.',
  })
  @ApiParam({ name: 'id', description: 'Discount code ID' })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<null>,
    description: 'Discount code deactivated',
  })
  @ApiNotFoundResponse({ description: 'Discount code not found' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.discountCodeService.deactivate(id, undefined, true);
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
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<null> {
    await this.discountCodeService.remove(id, undefined, true);
    return null;
  }
}
