import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ROLE } from '@prisma/client';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { CacheService } from 'src/modules/infrastructure/cache/cache.service';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('ADMIN - CACHE')
@ApiBearerAuth('JWT-auth')
@Controller('admin/cache')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
export class AdminCacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('flush')
  @HttpCode(HttpStatus.OK)
  @Message('Cache flushed successfully')
  @ApiOperation({
    summary: '⚠️ Flush entire Redis cache',
    description:
      '**Warning:** This endpoint permanently deletes ALL cached data (category tree, product listings, store profiles, etc.). ' +
      'Subsequent requests will hit the database directly until the cache is repopulated. ' +
      'Use sparingly — prefer letting TTLs expire naturally in most cases.',
  })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<{ message: string }>,
    description: 'All cached data has been flushed.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — admin access required',
  })
  async flush(): Promise<{ message: string }> {
    await this.cacheService.delByPattern('*');
    return { message: 'Cache flushed successfully' };
  }
}
