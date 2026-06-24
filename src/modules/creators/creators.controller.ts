import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
import { CreateCreatorDto } from './dto/create-creator.dto';
import { CreatorLoginDto } from './dto/update-creator.dto';
import { CreatorProfileDto } from './dto/creator-response.dto';
import { CreatorLoginResponseDto } from './dto/creator-login-response.dto';
import { CreatorResetPasswordDto } from './dto/creator-reset-password.dto';
import { GetCreator } from 'src/modules/shared/decorators/get-creator.decorator';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { StrictThrottle } from 'src/modules/shared/decorators/custom-throttler.decorator';
import { AuthCookieService } from 'src/modules/auth/auth-cookie.service';
import { AuthStrategy } from 'src/modules/shared/decorators/auth-strategy.decorator';
import {
  extractIpAddress,
  extractUserAgent,
} from 'src/modules/shared/utils/request.util';
import { OtpService } from 'src/modules/auth/services/otp.service';
import { RequestOtpDto } from 'src/modules/auth/dto/request-otp.dto';
import {
  CreatorJwtAuthGuard,
  CreatorRefreshGuard,
} from './guards/creator-auth.guard';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('CREATORS - AUTH')
@Controller('creators')
@AuthStrategy('creator-jwt')
@UseGuards(CreatorJwtAuthGuard)
export class CreatorsController {
  constructor(
    private readonly creatorsService: CreatorsService,
    private readonly authCookies: AuthCookieService,
    private readonly otpService: OtpService,
  ) {}

  @Public()
  @Post('auth/register')
  @Message('Creator registered successfully')
  @ApiOperation({
    summary: 'Register a new creator',
    description:
      'Create a new creator account with email, password, and store details.',
  })
  @ApiBody({ type: CreateCreatorDto })
  @ApiResponse({ status: 201, type: ApiResponseDto<CreatorProfileDto> })
  @ApiConflictResponse({
    description: 'Creator with this email already exists',
  })
  async register(
    @Body() dto: CreateCreatorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreatorProfileDto> {
    const session = await this.creatorsService.register(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    this.authCookies.setAuthCookies(res, session.tokens);
    return session.profile;
  }

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @Message('Login successful')
  @ApiOperation({
    summary: 'Creator login',
    description: 'Authenticate a creator with email and password.',
  })
  @ApiBody({ type: CreatorLoginDto })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorLoginResponseDto> })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() dto: CreatorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreatorLoginResponseDto> {
    const session = await this.creatorsService.login(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    this.authCookies.setAuthCookies(res, session.tokens);
    const { id, storeName, storeSlug, storeDescription } = session.profile;
    return { id, storeName, storeSlug, storeDescription };
  }

  @Post('auth/logout')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @Message('Logged out successfully')
  @ApiOperation({
    summary: 'Creator logout',
    description: 'Log out the authenticated creator from all sessions.',
  })
  @ApiNotFoundResponse({ description: 'Creator not found' })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'Logged out successfully',
  })
  async logout(
    @GetCreator('id') creatorId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    await this.creatorsService.logout(
      creatorId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    this.authCookies.clearAuthCookies(res);
    return null;
  }


  @Public()
  @StrictThrottle()
  @Post('auth/otp/request')
  @HttpCode(HttpStatus.OK)
  @Message('OTP requested successfully')
  @ApiOperation({
    summary: 'Request an OTP for creator registration or password reset',
    description:
      'Send a one-time password to the provided email for registration verification or password reset.',
  })
  @ApiBody({ type: RequestOtpDto })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  @ApiOkResponse({
    type: ApiResponseDto<null>,
    description: 'OTP requested successfully',
  })
  async requestOtp(@Body() dto: RequestOtpDto): Promise<null> {
    await this.otpService.createOtp(dto.email);
    return null;
  }

  @Public()
  @StrictThrottle()
  @Post('auth/reset-password')
  @HttpCode(HttpStatus.OK)
  @Message('Password reset successfully')
  @ApiOperation({
    summary: 'Reset creator password using OTP',
    description:
      'Reset the creator password using a verified OTP sent to their email.',
  })
  @ApiBody({ type: CreatorResetPasswordDto })
  @ApiBadRequestResponse({ description: 'Invalid or expired OTP' })
  @ApiNotFoundResponse({ description: 'Creator not found' })
  async resetPassword(
    @Body() dto: CreatorResetPasswordDto,
    @Req() req: Request,
  ): Promise<null> {
    await this.creatorsService.resetPassword(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    return null;
  }

  @Public()
  @UseGuards(CreatorRefreshGuard)
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @Message('Token refreshed successfully')
  @ApiOperation({
    summary: 'Refresh creator tokens',
    description: 'Refresh the access token using a valid refresh token.',
  })
  @ApiResponse({ status: 200, type: ApiResponseDto<CreatorProfileDto> })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired refresh token',
  })
  async refresh(
    @GetCreator('id') creatorId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreatorProfileDto> {
    const session = await this.creatorsService.refresh(creatorId);
    this.authCookies.setAuthCookies(res, session.tokens);
    return session.profile;
  }
}
