import { plainToInstance, Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  PORT: number = 3001;

  // ─── JWT ────────────────────────────────────────────────────────────────────

  @IsDefined()
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @IsDefined()
  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN = '7d';

  // ─── Database ────────────────────────────────────────────────────────────────

  @IsDefined()
  @IsString()
  POSTGRESQL_URL!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @IsOptional()
  PRISMA_SLOW_QUERY_MS: number = 500;

  // ─── Redis / BullMQ ──────────────────────────────────────────────────────────

  @IsString()
  @IsOptional()
  REDIS_URL = 'redis://localhost:6379';

  @IsString()
  @IsOptional()
  BULLMQ_PREFIX = '{nuts}';

  // ─── HTTP / CORS ─────────────────────────────────────────────────────────────

  @IsString()
  @IsOptional()
  ALLOWED_ORIGINS?: string;

  @IsString()
  @IsOptional()
  COOKIE_DOMAIN?: string;

  // ─── Payments ────────────────────────────────────────────────────────────────

  @IsString()
  @IsOptional()
  PAYSTACK_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  PAYSTACK_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  DEFAULT_CURRENCY = 'ngn';

  // ─── Mail / SMTP ─────────────────────────────────────────────────────────────

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_SERVICE?: string;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMTP_SECURE?: string;

  // ─── OTP ─────────────────────────────────────────────────────────────────────

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  OTP_TTL_MIN: number = 10;

  @Type(() => Number)
  @IsNumber()
  @Min(4)
  @IsOptional()
  OTP_LENGTH: number = 6;

  // ─── Users / Accounts ────────────────────────────────────────────────────────

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  ACCOUNT_DELETION_GRACE_DAYS?: number;

  // ─── Referrals ───────────────────────────────────────────────────────────────

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  REFERRAL_DISCOUNT_AMOUNT: number = 500;

  // ─── Admin ───────────────────────────────────────────────────────────────────

  @IsString()
  @IsOptional()
  ADMIN_SETUP_SECRET?: string;

  // ─── Checkout ────────────────────────────────────────────────────────────────

  @IsString()
  @IsOptional()
  CHECKOUT_REVALIDATE_PRICES: string = 'true';

  // ─── Dev / Tooling ───────────────────────────────────────────────────────────

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  SWAGGER_ENABLED = false;
}

const PROD_REQUIRED: Array<keyof EnvironmentVariables> = [
  'PAYSTACK_SECRET_KEY',
  'PAYSTACK_CALLBACK_URL',
  'ADMIN_SETUP_SECRET',
  'EMAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'ALLOWED_ORIGINS',
  'COOKIE_DOMAIN',
];

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map((e) => {
          const constraints = Object.values(e.constraints ?? {}).join(', ');
          return `  ${e.property}: ${constraints}`;
        })
        .join('\n')}`,
    );
  }

  if (validated.NODE_ENV === Environment.Production) {
    const missing = PROD_REQUIRED.filter((key) => !validated[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables:\n${missing
          .map((key) => `  - ${key}`)
          .join('\n')}`,
      );
    }
  }

  return validated;
}
