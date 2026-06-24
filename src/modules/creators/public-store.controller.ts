import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreatorsService } from './creators.service';
import { CreatorProfileDto } from './dto/creator-response.dto';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATORS - ACCOUNT')
@Public()
@Controller('creators/store')
export class PublicStoreController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get(':storeSlug')
  @Message('Store profile retrieved successfully')
  @ApiOperation({
    summary: 'Get public store profile by slug',
    description:
      'Retrieve a creator store profile by its slug. Only returns active, approved stores.',
  })
  @ApiParam({
    name: 'storeSlug',
    description: 'The store slug (e.g., "my-store")',
  })
  @ApiOkResponse({ type: ApiResponseDto<CreatorProfileDto> })
  @ApiNotFoundResponse({ description: 'Store not found' })
  async findStoreBySlug(
    @Param('storeSlug') storeSlug: string,
  ): Promise<CreatorProfileDto> {
    return this.creatorsService.findStoreBySlug(storeSlug);
  }

  @Get(':storeSlug/products')
  @Message('Store products retrieved successfully')
  @ApiOperation({
    summary: 'Get public store products',
    description: 'Retrieve all active products for a creator store by slug.',
  })
  @ApiParam({
    name: 'storeSlug',
    description: 'The store slug (e.g., "my-store")',
  })
  @ApiOkResponse({
    type: ApiResponseDto<CreatorProfileDto>,
    description: 'Store profile with products',
  })
  @ApiNotFoundResponse({ description: 'Store not found' })
  async findStoreProducts(@Param('storeSlug') storeSlug: string) {
    return this.creatorsService.findStoreProducts(storeSlug);
  }
}
