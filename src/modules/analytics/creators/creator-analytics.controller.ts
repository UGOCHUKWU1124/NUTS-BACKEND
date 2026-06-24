import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { CreatorAnalyticsSummaryDto } from './dto/creator-analytics-summary.dto';
import { CreatorAnalyticsQueryDto } from './dto/creator-analytics-query.dto';
import { CreatorJwtAuthGuard } from '../../creators/guards/creator-auth.guard';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATOR - ANALYTICS')
@Controller('creators/analytics')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
export class CreatorAnalyticsController {
  constructor(private readonly analyticsService: CreatorAnalyticsService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Message('Creator analytics retrieved')
  @ApiOperation({
    summary: 'Get creator store analytics with trends',
    description:
      "Retrieve aggregated analytics for the authenticated creator's store, including order stats, revenue, and trend data",
  })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<CreatorAnalyticsSummaryDto>,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid query parameters',
  })
  async getAnalytics(
    @GetCreator('id') creatorId: string,
    @Query() query: CreatorAnalyticsQueryDto,
  ): Promise<CreatorAnalyticsSummaryDto> {
    return this.analyticsService.getAnalytics(creatorId, query);
  }
}
