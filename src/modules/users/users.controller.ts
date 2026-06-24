import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import type { RequestWithUser } from 'src/modules/shared/interfaces/request-with-user.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { ReactivateAccountDto } from './dto/reactivate-account.dto';
import { DeactivateAccountResponseDto } from './dto/deactivate-account-response.dto';
import { AuthCookieService } from 'src/modules/auth/auth-cookie.service';
import type { Response } from 'express';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { OtpRequired } from 'src/modules/shared/decorators/otp-required.decorator';
import {
  extractIpAddress,
  extractUserAgent,
} from 'src/modules/shared/utils/request.util';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('USERS')
@Controller('account')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authCookies: AuthCookieService,
  ) {}

  //get current user profile
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Message('Profile retrieved successfully')
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieve the authenticated user profile.',
  })
  @ApiOkResponse({
    description: 'Profile retrieved successfully.',
    type: ApiResponseDto<UserResponseDto>,
  })
  @ApiNotFoundResponse({
    description: 'User account not found or has been deactivated',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getProfile(@Req() req: RequestWithUser): Promise<UserResponseDto> {
    return this.usersService.findOne(req.user.id);
  }

  //update current user profile
  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Message('Profile updated successfully')
  @ApiBody({ type: UpdateUserDto })
  @ApiOperation({
    summary: 'Update current user profile and saved shipping information',
    description:
      'Use this endpoint to update profile fields, update primary phone, create a new saved shipping address, or set an existing saved shipping address as the default.',
  })
  @ApiOkResponse({
    description: 'Profile updated successfully.',
    type: ApiResponseDto<UserResponseDto>,
  })
  @ApiNotFoundResponse({
    description: 'User account not found or has been deactivated',
  })
  @ApiConflictResponse({
    description: 'Email address is already in use by another account',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async updateProfile(
    @GetUser('id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.usersService.update(
      userId,
      updateUserDto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  //change current user password
  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Message('Password changed successfully')
  @ApiOperation({
    summary: 'Change current user password',
    description:
      'Changes the authenticated user password. Requires current password for verification.',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ description: 'Password changed successfully.' })
  @ApiBadRequestResponse({ description: 'Current password is incorrect' })
  @ApiNotFoundResponse({
    description: 'User account not found or has been deactivated',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async changePassword(
    @GetUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<null> {
    await this.usersService.changePassword(
      userId,
      changePasswordDto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    return null;
  }

  //deactivate current user account
  @Patch('deactivate')
  @UseGuards(JwtAuthGuard)
  @OtpRequired()
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Message('Account deactivated successfully')
  @ApiOperation({
    summary: 'Deactivate account',
    description:
      'Requires OTP verification. Disables the account and schedules permanent deletion after a grace period (default 60 days, configurable). Clears auth cookies.',
  })
  @ApiOkResponse({
    description: 'Account deactivated successfully. Auth cookies cleared.',
    type: ApiResponseDto<DeactivateAccountResponseDto>,
  })
  @ApiNotFoundResponse({
    description: 'User account not found or has been deactivated',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async deactivateAccount(
    @GetUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DeactivateAccountResponseDto> {
    const result = await this.usersService.deactivate(
      userId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    this.authCookies.clearAuthCookies(res);
    return result;
  }

  //reactivate current user account
  @Public()
  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @Message('Account reactivated successfully')
  @ApiOperation({
    summary: 'Reactivate a deactivated account',
    description:
      'Restores account if still within the grace period (default 60 days). Then sign in via /auth/login.',
  })
  @ApiBody({ type: ReactivateAccountDto })
  @ApiOkResponse({
    description: 'Account reactivated successfully.',
    type: ApiResponseDto<UserResponseDto>,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid email/password or account grace period has expired (account permanently deleted)',
  })
  async reactivate(
    @Body() dto: ReactivateAccountDto,
    @Req() req: Request,
  ): Promise<UserResponseDto> {
    return this.usersService.reactivate(
      dto.email,
      dto.password,
      extractIpAddress(req),
      extractUserAgent(req),
    );
  }

  //permanent delete current user account
  @Delete('delete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @Message('Account permanently deleted successfully')
  @ApiOperation({
    summary: 'Permanently delete account',
    description:
      'Irreversibly deletes the account. Admin accounts cannot be deleted.',
  })
  @ApiOkResponse({
    description: 'Account permanently deleted',
    type: ApiResponseDto<null>,
  })
  @ApiNotFoundResponse({
    description: 'User account not found or has been deactivated',
  })
  @ApiConflictResponse({
    description: 'Admin accounts cannot be deleted. Contact support.',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async permanentDelete(
    @GetUser('id') userId: string,
    @Req() req: Request,
  ): Promise<null> {
    await this.usersService.permanentDelete(
      userId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    return null;
  }
}
