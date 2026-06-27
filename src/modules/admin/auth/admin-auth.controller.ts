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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthCookieService } from 'src/modules/auth/auth-cookie.service';
import { AdminAuthService } from './admin-auth.service';
import { LoginDto } from 'src/modules/auth/dto/login.dto';
import { AdminRegisterDto } from './dto/admin-register.dto';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { Message } from 'src/modules/shared/decorators/message.decorator';
import { Public } from 'src/modules/shared/decorators/public.decorator';
import { StrictThrottle } from 'src/modules/shared/decorators/custom-throttler.decorator';
import { RefreshTokenGuard } from 'src/modules/auth/guards/refresh-token.guard';
import { RolesGuard } from 'src/modules/shared/guards/roles.guard';
import { Roles } from 'src/modules/shared/decorators/role.decorator';
import { GetUser } from 'src/modules/shared/decorators/get-user.decorator';
import { ROLE } from '@prisma/client';
import { AdminAuthResponseDto } from './dto/admin-auth-response.dto';
import {
  extractIpAddress,
  extractUserAgent,
} from 'src/modules/shared/utils/request.util';
import { ApiResponseDto } from 'src/modules/shared/dto/api-response.dto';
import { AccountLockGuard } from 'src/modules/security/guards/account-lock.guard';


@ApiTags('ADMIN - AUTH')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly authCookies: AuthCookieService,
  ) {}

  @Public()
  @StrictThrottle()
  @UseGuards(AccountLockGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Message('Admin logged in successfully')
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticates an admin user and sets httpOnly auth cookies ' +
      '(access + refresh). Only accounts with the ADMIN role are permitted. ' +
      'Non-admin users receive a 403 Forbidden response.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    type: ApiResponseDto<AdminAuthResponseDto>,
    description:
      'Login successful. Access and refresh tokens set as httpOnly cookies.',
  })
  @ApiBadRequestResponse({
    description: 'Validation error — invalid email or password format.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials — email or password is wrong.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — the user does not have the ADMIN role.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminAuthResponseDto> {
    const session = await this.adminAuthService.login(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );

    this.authCookies.setAuthCookies(res, session.tokens);

    return { user: session.user };
  }

  @Public()
  @StrictThrottle()
  @Post('setup')
  @HttpCode(HttpStatus.CREATED)
  @Message('Initial admin account created successfully')
  @ApiOperation({
    summary: 'Bootstrap the first admin account (one-time)',
    description:
      'Creates the initial admin account. This endpoint is only available ' +
      'when no admin exists in the database. Requires the ADMIN_SETUP_SECRET ' +
      'environment variable to be configured. After the first admin is ' +
      'created, this endpoint returns 409 Conflict.',
  })
  @ApiBody({ type: AdminRegisterDto })
  @ApiCreatedResponse({
    type: ApiResponseDto<AdminAuthResponseDto>,
    description:
      'Initial admin created. Auth cookies set with the new session.',
  })
  @ApiBadRequestResponse({
    description:
      'Validation error, or admin setup is not configured (ADMIN_SETUP_SECRET missing).',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid setup secret — the provided secret does not match.',
  })
  @ApiConflictResponse({
    description: 'Conflict — an admin account already exists.',
  })
  async setup(
    @Body() dto: AdminRegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminAuthResponseDto> {
    const session = await this.adminAuthService.setup(
      dto,
      extractIpAddress(req),
      extractUserAgent(req),
    );

    this.authCookies.setAuthCookies(res, session.tokens);

    return { user: session.user };
  }

  @Public()
  @StrictThrottle()
  @UseGuards(RefreshTokenGuard, RolesGuard)
  @Roles(ROLE.ADMIN)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Message('Admin token refreshed successfully')
  @ApiOperation({
    summary: 'Rotate admin access and refresh tokens',
    description:
      'Uses the httpOnly refresh_token cookie to issue a new access + ' +
      'refresh token pair. The previous refresh token is invalidated ' +
      '(rotation). Requires a valid refresh token and the ADMIN role.',
  })
  @ApiOkResponse({
    type: ApiResponseDto<AdminAuthResponseDto>,
    description: 'Tokens refreshed. New auth cookies set.',
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or expired refresh token.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — the user does not have the ADMIN role.',
  })
  async refresh(
    @GetUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminAuthResponseDto> {
    const session = await this.adminAuthService.refresh(userId);

    this.authCookies.setAuthCookies(res, session.tokens);

    return { user: session.user };
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Roles(ROLE.ADMIN)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Message('Admin logged out successfully')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Log out and invalidate the admin session',
    description:
      'Invalidates the current admin session and clears the httpOnly ' +
      'access and refresh cookies. Requires an active JWT session with ' +
      'the ADMIN role.',
  })
  @ApiOkResponse({
    description: 'Logged out successfully. Auth cookies cleared.',
    type: ApiResponseDto<null>,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized — no valid JWT session.',
  })
  @ApiForbiddenResponse({
    description: 'Forbidden — the user does not have the ADMIN role.',
  })
  async logout(
    @GetUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<null> {
    await this.adminAuthService.logout(
      userId,
      extractIpAddress(req),
      extractUserAgent(req),
    );
    this.authCookies.clearAuthCookies(res);
    return null;
  }
}
