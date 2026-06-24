import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreatorsService } from './creators.service';
import { UpdateCreatorDto } from './dto/update-creator.dto';
import { CreatorProfileDto } from './dto/creator-response.dto';
import { CreatorStatusResponseDto } from './dto/creator-status-response.dto';
import { CreatorReactivateDto } from './dto/creator-reactivate.dto';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import {
  extractIpAddress,
  extractUserAgent,
} from 'src/modules/shared/utils/request.util';
import { CreatorJwtAuthGuard } from './guards/creator-auth.guard';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATORS - ACCOUNT')
@Controller('creators')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
export class CreatorAccountController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get('account')
  @ApiBearerAuth('JWT-auth')
  @Message('Profile retrieved successfully')
  @ApiOperation({
    summary: 'Get creator profile',
    description: 'Retrieve the authenticated creator profile.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorProfileDto> })
  @ApiNotFoundResponse({ description: 'Creator not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getProfile(
    @GetCreator('id') creatorId: string,
  ): Promise<CreatorProfileDto> {
    return this.creatorsService.getProfile(creatorId);
  }

  @Patch('account')
  @ApiBearerAuth('JWT-auth')
  @Message('Profile updated successfully')
  @ApiOperation({
    summary: 'Update creator profile',
    description: 'Update the authenticated creator profile fields.',
  })
  @ApiBody({ type: UpdateCreatorDto })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorProfileDto> })
  @ApiNotFoundResponse({ description: 'Creator not found' })
  @ApiConflictResponse({ description: 'Email already in use' })
  async updateProfile(
    @GetCreator('id') creatorId: string,
    @Body() dto: UpdateCreatorDto,
    @Req() req: Request,
  ): Promise<CreatorProfileDto> {
    return this.creatorsService.updateProfile(
      creatorId,
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  @Public()
  @Post('account/reactivate')
  @HttpCode(HttpStatus.OK)
  @Message('Creator account reactivated successfully')
  @ApiOperation({
    summary: 'Reactivate a deactivated creator account',
    description:
      'Verify email and password to reactivate a deactivated creator account. Then sign in via /creators/login.',
  })
  @ApiBody({ type: CreatorReactivateDto })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorStatusResponseDto> })
  @ApiBadRequestResponse({ description: 'Invalid email or password' })
  @ApiConflictResponse({
    description: 'Account is not deactivated or grace period ended',
  })
  async reactivate(
    @Body() dto: CreatorReactivateDto,
    @Req() req: Request,
  ): Promise<CreatorStatusResponseDto> {
    return this.creatorsService.reactivate(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  @Patch('account/deactivate')
  @ApiBearerAuth('JWT-auth')
  @Message('Creator account deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate creator account',
    description: 'Deactivate the authenticated creator account.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorStatusResponseDto> })
  @ApiNotFoundResponse({ description: 'Creator not found' })
  @ApiConflictResponse({ description: 'Account is already deactivated' })
  async deactivateProfile(
    @GetCreator('id') creatorId: string,
    @Req() req: Request,
  ): Promise<CreatorStatusResponseDto> {
    return this.creatorsService.deactivateProfile(
      creatorId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  @Delete('account')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Message('Creator account deleted successfully')
  @ApiOperation({
    summary: 'Delete creator account permanently',
    description:
      'Permanently delete the authenticated creator account and all associated data.',
  })
  @ApiNotFoundResponse({ description: 'Creator not found' })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Creator account deleted successfully',
  })
  async deleteProfile(
    @GetCreator('id') creatorId: string,
    @Req() req: Request,
  ): Promise<null> {
    await this.creatorsService.deleteProfile(
      creatorId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    return null;
  }
}
