import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { AuditLogService } from 'src/modules/shared/audit-log/audit-log.service';
import { LoginDto } from 'src/modules/auth/dto/login.dto';
import { AdminRegisterDto } from './dto/admin-register.dto';
import { AdminAuthUserDto } from './dto/admin-auth-user.dto';
import { AuthTokens } from 'src/modules/auth/auth-cookie.service';
import { ROLE } from '@prisma/client';
import { BCRYPT_SALT_ROUNDS } from 'src/modules/shared/constants/bcrypt.constants';
import { AccountLockService } from 'src/modules/security/services/account-lock.service';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly accountLockService: AccountLockService,
  ) {}

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: AdminAuthUserDto; tokens: AuthTokens }> {
    const identifier = `email:${dto.email.toLowerCase().trim()}`;

    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin || !(await bcrypt.compare(dto.password, admin.password))) {
      this.logger.warn(`Failed login attempt for admin: ${dto.email}`);
      // Record failed attempt for brute-force protection
      await this.accountLockService
        .recordFailedAttempt(identifier)
        .catch(() => {});
      // Log failed login attempt
      await this.auditLog
        .log({
          action: 'ADMIN_LOGIN_FAILED',
          entity: 'Admin',
          entityId: admin?.id,
          payload: { email: dto.email },
          ipAddress,
          userAgent,
        })
        .catch(() => {});
      throw new UnauthorizedException('Invalid admin credentials');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Admin account is deactivated');
    }

    // Successful login — reset brute-force counter
    await this.accountLockService.resetAttempts(identifier).catch(() => {});

    const session = await this.issueSession(admin);

    await this.auditLog.log({
      action: 'ADMIN_LOGIN',
      entity: 'Admin',
      entityId: admin.id,
      adminId: admin.id,
      payload: { email: admin.email },
      ipAddress,
      userAgent,
    });

    return session;
  }

  async setup(
    dto: AdminRegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ user: AdminAuthUserDto; tokens: AuthTokens }> {
    const existingAdmins = await this.prisma.admin.count();

    if (existingAdmins > 0) {
      throw new BadRequestException('Admin setup has already been completed');
    }

    const setupSecret = this.configService.get<string>('ADMIN_SETUP_SECRET');
    if (!setupSecret) {
      throw new BadRequestException('Admin setup is not configured');
    }

    if (dto.setupSecret !== setupSecret) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const admin = await this.createAdminAccount(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
    );

    this.logger.log(`Initial admin account created: ${dto.email}`);

    await this.auditLog.log({
      action: 'ADMIN_SETUP',
      entity: 'Admin',
      entityId: admin.id,
      adminId: admin.id,
      payload: {
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
      },
      ipAddress,
      userAgent,
    });

    return this.issueSession(admin);
  }

  async refresh(
    adminId: string,
  ): Promise<{ user: AdminAuthUserDto; tokens: AuthTokens }> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    if (!admin.isActive) {
      throw new UnauthorizedException('Admin account is deactivated');
    }

    return this.issueSession(admin);
  }

  async logout(
    adminId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        refreshToken: null,
        refreshTokenId: null,
        tokenVersion: {
          increment: 1,
        },
      },
    });

    await this.auditLog.log({
      action: 'ADMIN_LOGOUT',
      entity: 'Admin',
      entityId: adminId,
      adminId,
      ipAddress,
      userAgent,
    });
  }

  private async issueSession(admin: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    tokenVersion: number;
  }): Promise<{ user: AdminAuthUserDto; tokens: AuthTokens }> {
    const user = this.toAuthUserDto(admin);
    const tokens = await this.generateTokens(
      admin.id,
      admin.email,
      admin.tokenVersion,
    );

    await this.storeRefreshToken(
      admin.id,
      tokens.refreshToken,
      tokens.refreshId,
    );

    return {
      user,
      tokens,
    };
  }

  private toAuthUserDto(admin: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }): AdminAuthUserDto {
    return {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    tokenVersion: number,
  ): Promise<AuthTokens> {
    const refreshId = randomBytes(16).toString('hex');

    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, role: ROLE.ADMIN, tokenVersion },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as StringValue,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email, role: ROLE.ADMIN, refreshId },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
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

    await this.prisma.admin.update({
      where: { id: userId },
      data: {
        refreshToken: hashed,
        refreshTokenId: refreshId,
      },
    });
  }

  private async createAdminAccount(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) {
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    return this.prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        role: ROLE.ADMIN,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
      },
    });
  }
}
