import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { AuditLogService } from 'src/modules/shared/audit-log/audit-log.service';
import { ReferralService } from 'src/modules/referral/referral.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthUserDto } from './dto/auth-response.dto';
import { DiscountCodeService } from 'src/modules/promotions/discount-code.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AccountLockService } from 'src/modules/security/services/account-lock.service';

/** Minimal user data returned in the login/registration/refresh response. */
type AuthUserData = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from 'src/modules/shared/constants/bcrypt.constants';
import { randomBytes } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpService } from 'src/modules/auth/services/otp.service';
import { EmailService } from 'src/modules/infrastructure/mail/email.service';
import type { StringValue } from 'ms';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshId: string;
}

export interface AuthSession {
  user: AuthUserDto;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly discountCodeService: DiscountCodeService,
    private readonly emailService: EmailService,
    private readonly auditLog: AuditLogService,
    private readonly referralService: ReferralService,
    private readonly accountLockService: AccountLockService,
  ) {}

  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthSession> {
    const { email, password, firstName, lastName, phone, shippingAddress } =
      dto;

    // Check for duplicate email first — short-circuit before any expensive operations
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw new ConflictException('User already exists');
    }

    // Validate referral code after confirming the email is new
    let validatedReferral: { id: string; userId: string } | null = null;
    if (dto.referralCode) {
      validatedReferral = await this.referralService.validateReferralCode(
        dto.referralCode,
        email,
      );
    }

    await this.otpService.verifyOtp(email, dto.otpCode);

    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
        },
        select: this.userSelect,
      });

      // Create dependent resources in parallel for better performance
      await Promise.all([
        tx.userWallet.create({
          data: { userId: user.id },
        }),
        tx.shippingAddress.create({
          data: {
            userId: user.id,
            fullName: shippingAddress.fullName,
            phone: shippingAddress.phone,
            street: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state,
            country: shippingAddress.country ?? 'Nigeria',
            isDefault: true,
          },
        }),
        this.referralService.createReferralCode(tx, user.id),
      ]);

      return user;
    });

    // Use validated referral data — no re-fetch needed
    if (validatedReferral) {
      await this.referralService.applyReferralAtSignupById(
        result.id,
        validatedReferral.id,
        validatedReferral.userId,
      );
    }

    await this.auditLog.log({
      action: 'USER_REGISTER',
      entity: 'User',
      entityId: result.id,
      userId: result.id,
      payload: {
        email: result.email,
        hasReferral: !!dto.referralCode,
      },
      ipAddress,
      userAgent,
    });

    this.emailService
      .sendWelcomeEmail(email, firstName ?? '')
      .catch((err) => this.logger.error('Failed to send welcome email', err));

    return this.issueSession(result);
  }
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthSession> {
    const identifier = `email:${dto.email.toLowerCase().trim()}`;

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        password: true,
        isActive: true,
        ...this.userSelect,
      },
    });

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      // Record failed attempt for brute-force protection
      await this.accountLockService
        .recordFailedAttempt(identifier)
        .catch(() => {});
      // Log failed login attempt
      await this.auditLog
        .log({
          action: 'USER_LOGIN_FAILED',
          entity: 'User',
          entityId: user?.id,
          payload: { email: dto.email },
          ipAddress,
          userAgent,
        })
        .catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Successful login — reset brute-force counter
    await this.accountLockService.resetAttempts(identifier).catch(() => {});

    const userData: AuthUserData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    const session = await this.issueSession(userData);

    await this.auditLog.log({
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user.id,
      userId: user.id,
      payload: { email: user.email },
      ipAddress,
      userAgent,
    });

    return session;
  }

  async refresh(userId: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, ...this.userSelect },
    });

    if (!user) throw new UnauthorizedException('User not found');
    if (!user.isActive)
      throw new UnauthorizedException('Account is deactivated');

    return this.issueSession(user);
  }

  async logout(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenId: null,
      },
    });

    await this.auditLog.log({
      action: 'USER_LOGOUT',
      entity: 'User',
      entityId: userId,
      userId,
      ipAddress,
      userAgent,
    });
  }

  async resetPassword(
    dto: ResetPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // OTP verified first - no need to find user beforehand
    await this.otpService.verifyOtp(dto.email, dto.otpCode);

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    const result = await this.prisma.user
      .update({
        where: { email: dto.email },
        data: {
          password: hashedPassword,
          refreshToken: null,
          refreshTokenId: null,
        },
      })
      .catch(() => {
        throw new BadRequestException('Invalid email or reset code');
      });

    await this.auditLog.log({
      action: 'USER_RESET_PASSWORD',
      entity: 'User',
      entityId: result.id,
      userId: result.id,
      ipAddress,
      userAgent,
    });

    this.emailService
      .sendPasswordResetSuccessEmail(dto.email, result.firstName ?? '')
      .catch((err) =>
        this.logger.error(
          'Failed to send password reset confirmation email',
          err,
        ),
      );
  }

  // ------------------------
  // SESSION CORE
  // ------------------------

  private async issueSession(user: AuthUserData): Promise<AuthSession> {
    try {
      const normalizedUser = this.toAuthUserDto(user);
      const tokens = await this.generateTokens(
        normalizedUser.id,
        normalizedUser.email,
      );

      await this.storeRefreshToken(
        normalizedUser.id,
        tokens.refreshToken,
        tokens.refreshId,
      );

      return {
        user: normalizedUser,
        tokens,
      };
    } catch (error) {
      this.logger.error('Failed to issue session', error);
      throw error;
    }
  }

  private toAuthUserDto(user: AuthUserData): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const refreshId = randomBytes(16).toString('hex');

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.configService.getOrThrow('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as StringValue,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email, refreshId },
      {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as StringValue,
      },
    );

    return { accessToken, refreshToken, refreshId };
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    refreshId: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: hashed,
        refreshTokenId: refreshId,
      },
    });
  }

  private readonly userSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
  } as const;
}
