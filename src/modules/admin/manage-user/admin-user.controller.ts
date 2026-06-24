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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { OtpRequired } from 'src/modules/shared/decorators/otp-required.decorator';
import { ROLE } from '@prisma/client';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';

import { UsersService } from 'src/modules/users/users.service';
import { UserResponseDto } from 'src/modules/users/dto/user-response.dto';
import { UserListItemResponseDto } from 'src/modules/users/dto/user-list-item-response.dto';
import { QueryUserDto } from 'src/modules/users/dto/query-user.dto';
import { DeactivateAccountResponseDto } from 'src/modules/users/dto/deactivate-account-response.dto';
import { AdminDeactivateDto } from 'src/modules/users/dto/admin-deactivate.dto';
import {
  extractIpAddress,
  extractUserAgent,
} from 'src/modules/shared/utils/request.util';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@Roles(ROLE.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('ADMIN - USERS')
@ApiBearerAuth('JWT-auth')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET ALL USERS
  @Get()
  @Message('Users retrieved successfully')
  @ApiOperation({
    summary: 'List users with pagination (admin)',
    description: 'Retrieve a paginated list of all users.',
  })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<UserListItemResponseDto[]>,
    description: 'Paginated list of users',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — user does not have ADMIN role.',
  })
  async findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  // GET USER BY ID
  @Get(':id')
  @Message('User retrieved successfully')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve a single user by their unique ID.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<UserResponseDto> })
  @ApiNotFoundResponse({ description: 'User not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  // DEACTIVATE USER
  @Patch(':id/deactivate')
  @OtpRequired()
  @Message('User deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate user account (admin)',
    description: 'Deactivate a user account with a required reason.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: AdminDeactivateDto })
  @ApiResponse({
    status: 200,
    type: ApiResponseDto<DeactivateAccountResponseDto>,
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid deactivation reason.',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  async adminDeactivate(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: AdminDeactivateDto,
    @Req() req: Request,
  ): Promise<DeactivateAccountResponseDto> {
    return this.usersService.adminDeactivate(
      adminId,
      userId,
      dto.reason,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  // REACTIVATE USER
  @Patch(':id/reactivate')
  @OtpRequired()
  @HttpCode(HttpStatus.OK)
  @Message('User account reactivated')
  @ApiOperation({
    summary: 'Reactivate user account (admin)',
    description: 'Reactivate a previously deactivated user account.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, type: ApiResponseDto<UserResponseDto> })
  @ApiNotFoundResponse({ description: 'User not found.' })
  async adminReactivate(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) userId: string,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.usersService.adminReactivate(
      userId,
      adminId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  // DELETE USER PERMANENTLY
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Message('User permanently deleted')
  @ApiOperation({
    summary: 'Permanently delete user immediately (admin)',
    description: 'Permanently delete a user account and all associated data.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiConflictResponse({
    description: 'User has related records or is admin',
  })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'User permanently deleted',
  })
  async permanentDelete(
    @GetUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<null> {
    await this.usersService.permanentRemove(
      id,
      adminId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    return null;
  }
}
