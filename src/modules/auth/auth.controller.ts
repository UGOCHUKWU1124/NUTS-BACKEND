import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { AuthCookieService } from './auth-cookie.service';
import { OtpService } from 'src/modules/auth/services/otp.service';

import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { JwtAuthGuard } from 'src/modules/shared/guards/jwt-auth.guard';

import { Message } from 'src/modules/shared/decorators/message.decorator';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { StrictThrottle } from 'src/modules/shared/decorators/custom-throttler.decorator';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import {
  extractIpAddress,
  extractUserAgent,
} from 'src/modules/shared/utils/request.util';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';

@ApiTags('AUTH')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookies: AuthCookieService,
    private readonly otpService: OtpService,
  ) {}

  @Public()
  @StrictThrottle()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Message('User registered successfully')
  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Creates a new user account. An OTP must first be obtained via POST /auth/otp/request. Sets httpOnly auth cookies on success.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User registered successfully. Auth cookies set.',
    type: ApiResponseDto<AuthResponseDto>,
  })
  @ApiBadRequestResponse({ description: 'Validation error or invalid OTP' })
  @ApiConflictResponse({ description: 'A user with this email already exists' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.authService.register(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    this.authCookies.setAuthCookies(res, session.tokens);
    return { user: session.user };
  }

  @Public()
  @StrictThrottle()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Message('Logged in successfully')
  @ApiOperation({
    summary: 'Log in with email and password',
    description:
      'Authenticates the user and sets httpOnly auth cookies (access_token + refresh_token) on the response.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful. Auth cookies set.',
    type: ApiResponseDto<AuthResponseDto>,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.authService.login(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );

    this.authCookies.setAuthCookies(res, session.tokens);

    return { user: session.user };
  }

  @Public()
  @StrictThrottle()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Uses the httpOnly refresh_token cookie to issue new access and refresh tokens. The old refresh token is rotated.',
  })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully. New auth cookies set.',
    type: ApiResponseDto<AuthResponseDto>,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token missing, invalid, or expired',
  })
  async refresh(
    @GetUser() user: { id: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.authService.refresh(user.id);

    this.authCookies.setAuthCookies(res, session.tokens);

    return { user: session.user };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Message('Successfully logged out')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Log out current user',
    description:
      'Invalidates the current session and clears httpOnly auth cookies.',
  })
  @ApiOkResponse({
    description: 'Logged out successfully. Auth cookies cleared.',
    type: ApiResponseDto<null>,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async logout(
    @GetUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    await this.authService.logout(
      userId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    this.authCookies.clearAuthCookies(res);
    return null;
  }

  @Public()
  @StrictThrottle()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Message('OTP requested successfully')
  @ApiOperation({
    summary: 'Request a one-time password (OTP)',
    description:
      'Sends an OTP to the provided email for account registration or password reset. Rate-limited per IP.',
  })
  @ApiBody({ type: RequestOtpDto })
  @ApiOkResponse({
    description: 'OTP sent to email if account exists.',
    type: ApiResponseDto<null>,
  })
  @ApiBadRequestResponse({ description: 'Validation error' })
  @ApiTooManyRequestsResponse({
    description: 'Too many OTP requests. Please wait before retrying.',
  })
  async requestOtp(@Body() dto: RequestOtpDto): Promise<null> {
    await this.otpService.createOtp(dto.email);
    return null;
  }

  @Public()
  @StrictThrottle()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Message('Password reset successfully')
  @ApiOperation({
    summary: 'Reset password using OTP',
    description:
      'Resets the user password using an OTP previously obtained via POST /auth/otp/request.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    description: 'Password reset successfully.',
    type: ApiResponseDto<null>,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid or expired OTP. Request a new one via POST /auth/otp/request.',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<null> {
    await this.authService.resetPassword(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    return null;
  }
}
