import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Query,
  ParseUUIDPipe,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminCreatorsService } from './admin-creators.service';
import { CreatorProfileDto } from 'src/modules/creators/dto/creator-response.dto';
import { CreatorStatusResponseDto } from 'src/modules/creators/dto/creator-status-response.dto';
import { QueryAdminCreatorsDto } from './dto/query-admin-creators.dto';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { ROLE } from '@prisma/client';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import {
  extractIpAddress,
  extractUserAgent,
} from 'src/modules/shared/utils/request.util';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiBearerAuth('JWT-auth')
@ApiTags('ADMIN - CREATORS')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
@Controller('admin/creators')
export class AdminCreatorsController {
  constructor(private readonly adminCreatorsService: AdminCreatorsService) {}

  @Get()
  @Message('Creators retrieved successfully')
  @ApiOperation({
    summary: 'List creators (admin)',
    description: 'Retrieve a paginated list of all creators.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorProfileDto[]> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  async findAll(@Query() query: QueryAdminCreatorsDto) {
    return this.adminCreatorsService.findAll(query);
  }

  @Get(':id')
  @Message('Creator retrieved successfully')
  @ApiOperation({
    summary: 'Get creator by ID',
    description: 'Retrieve a single creator by their unique ID.',
  })
  @ApiParam({ name: 'id', description: 'Creator ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorProfileDto> })
  @ApiNotFoundResponse({ description: 'Creator not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CreatorProfileDto> {
    return this.adminCreatorsService.findOne(id);
  }

  @Patch(':id/approve')
  @Message('Creator approved successfully')
  @ApiOperation({
    summary: 'Approve creator account (admin)',
    description: 'Approve a pending creator account.',
  })
  @ApiParam({ name: 'id', description: 'Creator ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorStatusResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiNotFoundResponse({ description: 'Creator not found.' })
  async approve(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<CreatorStatusResponseDto> {
    return this.adminCreatorsService.approve(
      adminId,
      id,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  @Patch(':id/verify')
  @Message('Creator verified successfully')
  @ApiOperation({
    summary: 'Verify creator account (admin)',
    description: 'Verify a creator account to grant verified status.',
  })
  @ApiParam({ name: 'id', description: 'Creator ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorStatusResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiNotFoundResponse({ description: 'Creator not found.' })
  async verify(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<CreatorStatusResponseDto> {
    return this.adminCreatorsService.verify(
      adminId,
      id,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  @Patch(':id/deactivate')
  @Message('Creator deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate creator account (admin)',
    description: 'Deactivate a creator account, removing public visibility.',
  })
  @ApiParam({ name: 'id', description: 'Creator ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorStatusResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiNotFoundResponse({ description: 'Creator not found.' })
  async deactivate(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<CreatorStatusResponseDto> {
    return this.adminCreatorsService.deactivate(
      adminId,
      id,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  @Patch(':id/reactivate')
  @Message('Creator reactivated successfully')
  @ApiOperation({
    summary: 'Reactivate creator account (admin)',
    description: 'Reactivate a previously deactivated creator account.',
  })
  @ApiParam({ name: 'id', description: 'Creator ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorStatusResponseDto> })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiNotFoundResponse({ description: 'Creator not found.' })
  async reactivate(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<CreatorStatusResponseDto> {
    return this.adminCreatorsService.reactivate(
      adminId,
      id,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Message('Creator permanently deleted successfully')
  @ApiOperation({
    summary: 'Delete creator account permanently (admin)',
    description:
      'Permanently delete a creator account and all associated data.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiNotFoundResponse({ description: 'Creator not found.' })
  async delete(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.adminCreatorsService.delete(
      adminId,
      id,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }
}
