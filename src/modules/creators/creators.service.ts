import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CacheService } from 'src/modules/infrastructure/cache/cache.service';
import {
  CREATOR_STORE,
  CREATOR_STORE_PRODUCTS,
  CREATOR_STORE_TTL,
} from 'src/modules/shared/constants/cache.constant';
import {
  AuditLogService,
  type AuditChanges,
  toAuditPayload,
} from 'src/modules/shared/audit-log/audit-log.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto, CreatorLoginDto } from './dto/update-creator.dto';
import { CreatorProfileDto } from './dto/creator-response.dto';
import { CreatorStatusResponseDto } from './dto/creator-status-response.dto';
import { CreatorReactivateDto } from './dto/creator-reactivate.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { BCRYPT_SALT_ROUNDS } from 'src/modules/shared/constants/bcrypt.constants';
import { randomBytes } from 'crypto';
import type { StringValue } from 'ms';
import { generateSlug } from 'src/modules/shared/utils/slug.util';
import { AuthTokens } from 'src/modules/auth/auth-cookie.service';
import { OtpService } from 'src/modules/auth/services/otp.service';
import { EmailService } from 'src/modules/infrastructure/mail/email.service';
import { CreatorResetPasswordDto } from './dto/creator-reset-password.dto';
import { AccountLockService } from 'src/modules/security/services/account-lock.service';

const creatorSelect = {
  id: true,
  email: true,
  storeName: true,
  storeSlug: true,
  storeDescription: true,
  businessPhone: true,
  businessEmail: true,
  storeLogoUrl: true,
  storeLogoAltText: true,
  isVerified: true,
  isActive: true,
  isApproved: true,
  firstName: true,
  lastName: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

type CreatorSelectPayload = Prisma.CreatorGetPayload<{
  select: typeof creatorSelect;
}>;

export interface CreatorSession {
  profile: CreatorProfileDto;
  tokens: AuthTokens;
}

@Injectable()
export class CreatorsService {
  private readonly creatorSelect = creatorSelect;
  private readonly logger = new Logger(CreatorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly auditLog: AuditLogService,
    private readonly cacheService: CacheService,
    private readonly accountLockService: AccountLockService,
  ) {}

  async register(
    dto: CreateCreatorDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorSession> {
    const slugSource = dto.storeSlug?.trim() || dto.storeName.trim();
    const storeSlug = generateSlug(slugSource);

    if (!storeSlug) {
      throw new BadRequestException('Invalid store slug or store name');
    }

    const existingCreator = await this.prisma.creator.findFirst({
      where: {
        OR: [{ email: dto.email }, { storeSlug }],
      },
    });

    if (existingCreator) {
      throw new ConflictException('Email or store slug already in use');
    }

    await this.otpService.verifyOtp(dto.email, dto.otpCode);

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const creator = await this.prisma.creator.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        storeName: dto.storeName,
        storeSlug,
        storeDescription: dto.storeDescription ?? '',
        businessPhone: dto.businessPhone,
        businessEmail: dto.businessEmail ?? '',
        firstName: dto.firstName ?? '',
        lastName: dto.lastName ?? '',
        phone: dto.phone,
      },
      select: this.creatorSelect,
    });

    await this.auditLog.log({
      action: 'CREATOR_REGISTER',
      entity: 'Creator',
      entityId: creator.id,
      payload: {
        email: creator.email,
        storeName: creator.storeName,
        storeSlug: creator.storeSlug,
      },
      ipAddress,
      userAgent,
    });

    await this.prisma.creatorWallet.create({
      data: { creatorId: creator.id },
    });


    this.emailService
      .sendWelcomeEmail(dto.email, dto.firstName ?? '')
      .catch((err) => this.logger.error('Failed to send welcome email', err));

    const tokens = await this.generateTokens(creator.id, creator.email);
    await this.storeRefreshToken(
      creator.id,
      tokens.refreshToken,
      tokens.refreshId,
    );

    return {
      profile: this.toCreatorProfile(creator),
      tokens,
    };
  }

  async login(
    dto: CreatorLoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorSession> {
    const identifier = `email:${dto.email.toLowerCase().trim()}`;
    const loginSelect = {
      ...this.creatorSelect,
      password: true,
    } as const;

    const creator = await this.prisma.creator.findUnique({
      where: { email: dto.email },
      select: loginSelect,
    });

    if (!creator || !(await bcrypt.compare(dto.password, creator.password))) {
      // Record failed attempt for brute-force protection
      await this.accountLockService.recordFailedAttempt(identifier).catch(() => {});
      // Log failed login attempt
      await this.auditLog
        .log({
          action: 'CREATOR_LOGIN_FAILED',
          entity: 'Creator',
          entityId: creator?.id,
          payload: { email: dto.email },
          ipAddress,
          userAgent,
        })
        .catch(() => {});
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!creator.isActive) {
      throw new UnauthorizedException('Creator account is deactivated');
    }

    if (!creator.isApproved) {
      throw new UnauthorizedException('Creator account is not approved yet');
    }

    // Successful login — reset brute-force counter
    await this.accountLockService.resetAttempts(identifier).catch(() => {});

    const tokens = await this.generateTokens(creator.id, creator.email);
    await this.storeRefreshToken(
      creator.id,
      tokens.refreshToken,
      tokens.refreshId,
    );

    await this.auditLog.log({
      action: 'CREATOR_LOGIN',
      entity: 'Creator',
      entityId: creator.id,
      payload: { email: creator.email, storeName: creator.storeName },
      ipAddress,
      userAgent,
    });

    return {
      profile: this.toCreatorProfile(creator),
      tokens,
    };
  }

  async getProfile(creatorId: string): Promise<CreatorProfileDto> {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      select: this.creatorSelect,
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return this.toCreatorProfile(creator);
  }

  async updateProfile(
    creatorId: string,
    dto: UpdateCreatorDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorProfileDto> {
    const creator = await this.getCreatorOrThrow(creatorId);

    const data: Prisma.CreatorUpdateInput = {
      storeDescription: dto.storeDescription,
      businessPhone: dto.businessPhone,
      businessEmail: dto.businessEmail,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      storeLogoUrl: dto.storeLogoUrl,
    };

    if (dto.storeName && dto.storeName !== creator.storeName) {
      const storeSlug = generateSlug(dto.storeName.trim());
      if (!storeSlug) {
        throw new BadRequestException('Invalid store name');
      }

      const existingSlug = await this.prisma.creator.findFirst({
        where: { storeSlug, id: { not: creatorId } },
      });

      if (existingSlug) {
        throw new ConflictException(
          'Store slug generated from storeName is already in use',
        );
      }

      data.storeName = dto.storeName;
      data.storeSlug = storeSlug;
    }

    const updated = await this.prisma.creator.update({
      where: { id: creatorId },
      data,
      select: this.creatorSelect,
    });

    // Build a diff of only the fields that actually changed
    const changedFields: AuditChanges = {};
    for (const [key, value] of Object.entries(data)) {
      const oldVal = creator[key as keyof typeof creator];
      if (value !== undefined && oldVal !== value) {
        changedFields[key] = {
          old: oldVal ?? null,
          new: JSON.parse(JSON.stringify(value)) as AuditChanges[string]['new'],
        };
      }
    }

    if (Object.keys(changedFields).length > 0) {
      await this.auditLog.log({
        action: 'CREATOR_UPDATE_PROFILE',
        entity: 'Creator',
        entityId: creatorId,
        payload: toAuditPayload({ changes: changedFields }),
        ipAddress,
        userAgent,
      });
    }


    // Invalidate public store cache
    await this.cacheService.del(CREATOR_STORE(updated.storeSlug));
    await this.cacheService.delByPattern(
      `creator:store:${updated.storeSlug}:products`,
    );

    return this.toCreatorProfile(updated);
  }

  async deactivateProfile(
    creatorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorStatusResponseDto> {
    await this.getCreatorOrThrow(creatorId);

    const updated = await this.prisma.creator.update({
      where: { id: creatorId },
      data: { isActive: false, deactivatedAt: new Date() },
      select: {
        id: true,
        isActive: true,
        isApproved: true,
        isVerified: true,
        updatedAt: true,
        email: true,
        storeName: true,
      },
    });

    await this.auditLog.log({
      action: 'CREATOR_SELF_DEACTIVATE',
      entity: 'Creator',
      entityId: creatorId,
      payload: { email: updated.email, storeName: updated.storeName },
      ipAddress,
      userAgent,
    });


    return {
      id: updated.id,
      isActive: updated.isActive,
      isApproved: updated.isApproved,
      isVerified: updated.isVerified,
      updatedAt: updated.updatedAt,
    };
  }

  async reactivate(
    dto: CreatorReactivateDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<CreatorStatusResponseDto> {
    const creator = await this.prisma.creator.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        password: true,
        isActive: true,
        storeName: true,
        storeDescription: true,
        firstName: true,
        lastName: true,
        isApproved: true,
        createdAt: true,
      },
    });

    if (!creator) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (creator.isActive) {
      throw new BadRequestException('Account is already active');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      creator.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const updated = await this.prisma.creator.update({
      where: { id: creator.id },
      data: {
        isActive: true,
        deactivatedAt: null,
        deactivatedReason: null,
      },
      select: {
        id: true,
        isActive: true,
        isApproved: true,
        isVerified: true,
        updatedAt: true,
        email: true,
        storeName: true,
      },
    });

    await this.auditLog.log({
      action: 'CREATOR_SELF_REACTIVATE',
      entity: 'Creator',
      entityId: creator.id,
      payload: { email: updated.email, storeName: updated.storeName },
      ipAddress,
      userAgent,
    });


    return {
      id: updated.id,
      isActive: updated.isActive,
      isApproved: updated.isApproved,
      isVerified: updated.isVerified,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteProfile(
    creatorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    let creator: { id: string; email: string; storeName: string };
    try {
      creator = await this.prisma.creator.delete({
        where: { id: creatorId },
        select: { id: true, email: true, storeName: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Creator not found');
      }
      throw error;
    }

    await this.auditLog.log({
      action: 'CREATOR_SELF_DELETE',
      entity: 'Creator',
      entityId: creatorId,
      payload: { email: creator.email, storeName: creator.storeName },
      ipAddress,
      userAgent,
    });
  }

  // ─────────────────────────────────────────────
  // PUBLIC STORE PROFILE
  // ─────────────────────────────────────────────

  async findStoreBySlug(storeSlug: string): Promise<CreatorProfileDto> {
    return this.cacheService.wrap(
      CREATOR_STORE(storeSlug),
      CREATOR_STORE_TTL,
      async () => {
        const creator = await this.prisma.creator.findUnique({
          where: { storeSlug },
          select: this.creatorSelect,
        });

        if (!creator) {
          throw new NotFoundException('Store not found');
        }

        if (!creator.isActive || !creator.isApproved) {
          throw new NotFoundException('Store not found');
        }

        return this.toCreatorProfile(creator);
      },
    );
  }

  // ─────────────────────────────────────────────
  // PUBLIC STORE PRODUCTS
  // ─────────────────────────────────────────────

  async findStoreProducts(storeSlug: string): Promise<{
    store: CreatorProfileDto;
    products: any[];
  }> {
    return this.cacheService.wrap(
      CREATOR_STORE_PRODUCTS(storeSlug),
      CREATOR_STORE_TTL,
      async () => {
        // Single query with nested relation — eliminates the separate products query
        // Optimized to use select instead of include for variants
        const creator = await this.prisma.creator.findUnique({
          where: { storeSlug, isActive: true, isApproved: true },
          select: {
            ...this.creatorSelect,
            products: {
              where: { isDeleted: false, isActive: true },
              take: 50,
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                stock: true,
                hasVariants: true,
                createdAt: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
                variants: {
                  where: { isDeleted: false },
                  orderBy: { createdAt: 'asc' },
                  select: {
                    id: true,
                    options: true,
                    stock: true,
                    isActive: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        if (!creator) {
          throw new NotFoundException('Store not found');
        }

        const { products, ...storeData } = creator as CreatorSelectPayload & {
          products: any[];
        };

        return {
          store: this.toCreatorProfile(storeData as CreatorSelectPayload),
          products,
        };
      },
    );
  }

  private async getCreatorOrThrow(creatorId: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      select: {
        id: true,
        storeName: true,
        email: true,
        storeSlug: true,
        isActive: true,
      },
    });

    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return creator;
  }

  private toCreatorProfile(creator: CreatorSelectPayload): CreatorProfileDto {
    return {
      id: creator.id,
      email: creator.email,
      storeName: creator.storeName,
      storeSlug: creator.storeSlug,
      storeDescription: creator.storeDescription,
      businessPhone: creator.businessPhone,
      businessEmail: creator.businessEmail,
      storeLogoUrl: creator.storeLogoUrl,
      storeLogoAltText: creator.storeLogoAltText,
      firstName: creator.firstName,
      lastName: creator.lastName,
      phone: creator.phone,
      isVerified: creator.isVerified,
      isActive: creator.isActive,
      isApproved: creator.isApproved,
      createdAt: creator.createdAt,
      updatedAt: creator.updatedAt,
    };
  }


  async resetPassword(
    dto: CreatorResetPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const creator = await this.prisma.creator.findUnique({
      where: { email: dto.email },
    });

    if (!creator) {
      throw new BadRequestException('Invalid email or reset code');
    }

    await this.otpService.verifyOtp(dto.email, dto.otpCode);

    const hashedPassword = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    await this.prisma.creator.update({
      where: { email: dto.email },
      data: {
        password: hashedPassword,
        refreshToken: null,
        refreshTokenId: null,
      },
    });

    await this.auditLog.log({
      action: 'CREATOR_RESET_PASSWORD',
      entity: 'Creator',
      entityId: creator.id,
      ipAddress,
      userAgent,
    });

    this.emailService
      .sendPasswordResetSuccessEmail(dto.email, creator.firstName ?? '')
      .catch((err) =>
        this.logger.error(
          'Failed to send password reset confirmation email',
          err,
        ),
      );
  }

  async logout(
    creatorId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.creator.update({
      where: { id: creatorId },
      data: {
        refreshToken: null,
        refreshTokenId: null,
      },
    });

    await this.auditLog.log({
      action: 'CREATOR_LOGOUT',
      entity: 'Creator',
      entityId: creatorId,
      ipAddress,
      userAgent,
    });
  }

  async refresh(creatorId: string): Promise<CreatorSession> {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
      select: this.creatorSelect,
    });

    if (!creator) {
      throw new UnauthorizedException('Creator not found');
    }

    if (!creator.isActive) {
      throw new UnauthorizedException('Creator account is deactivated');
    }

    if (!creator.isApproved) {
      throw new UnauthorizedException('Creator account is not approved yet');
    }

    const tokens = await this.generateTokens(creator.id, creator.email);
    await this.storeRefreshToken(
      creator.id,
      tokens.refreshToken,
      tokens.refreshId,
    );

    return {
      profile: this.toCreatorProfile(creator),
      tokens,
    };
  }

  private async generateTokens(
    creatorId: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string; refreshId: string }> {
    const refreshId = randomBytes(16).toString('hex');

    const accessToken = await this.jwtService.signAsync(
      { sub: creatorId, email, type: 'creator' },
      {
        secret: this.configService.getOrThrow('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN') as StringValue,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { sub: creatorId, email, refreshId, type: 'creator' },
      {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
      },
    );

    return { accessToken, refreshToken, refreshId };
  }

  private async storeRefreshToken(
    creatorId: string,
    refreshToken: string,
    refreshId: string,
  ): Promise<void> {
    const hashed = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);

    await this.prisma.creator.update({
      where: { id: creatorId },
      data: {
        refreshToken: hashed,
        refreshTokenId: refreshId,
      },
    });
  }
}
