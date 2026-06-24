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
import { ShippingAddressesService } from './shipping-addresses.service';
import { CreateShippingAddressDto } from './dto/create-shipping-address.dto';
import { ShippingAddressResponseDto } from './dto/shipping-address-response.dto';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('SHIPPING ADDRESSES')
@ApiBearerAuth('JWT-auth')
@Controller('users/addresses')
@UseGuards(JwtAuthGuard)
export class ShippingAddressesController {
  constructor(private readonly service: ShippingAddressesService) {}

  @Get()
  @Message('Shipping addresses retrieved successfully')
  @ApiOperation({
    summary: 'List all shipping addresses',
    description: 'Retrieve all shipping addresses for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<ShippingAddressResponseDto[]>,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAll(
    @GetUser('id') userId: string,
  ): Promise<ShippingAddressResponseDto[]> {
    return this.service.findAll(userId);
  }

  @Post()
  @Message('Shipping address created successfully')
  @ApiOperation({
    summary: 'Create a new shipping address',
    description: 'Create a new shipping address for the authenticated user.',
  })
  @ApiBody({ type: CreateShippingAddressDto })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiResponse({
    status: 201,
    type: ApiResponseDto<ShippingAddressResponseDto>,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async create(
    @GetUser('id') userId: string,
    @Body() dto: CreateShippingAddressDto,
  ): Promise<ShippingAddressResponseDto> {
    return this.service.create(userId, dto);
  }

  @Patch(':id/default')
  @Message('Default shipping address set successfully')
  @ApiOperation({
    summary: 'Set a shipping address as the default',
    description:
      'Set a shipping address as the default for the authenticated user.',
  })
  @ApiParam({ name: 'id', description: 'Shipping address ID' })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<ShippingAddressResponseDto>,
  })
  @ApiNotFoundResponse({ description: 'Shipping address not found' })
  async setDefault(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ShippingAddressResponseDto> {
    return this.service.setDefault(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Message('Shipping address deleted successfully')
  @ApiOperation({
    summary: 'Delete a shipping address',
    description: 'Delete a shipping address by its ID.',
  })
  @ApiParam({ name: 'id', description: 'Shipping address ID' })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<null>,
    description: 'Shipping address deleted',
  })
  @ApiNotFoundResponse({ description: 'Shipping address not found' })
  async remove(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<null> {
    await this.service.remove(userId, id);
    return null;
  }
}
