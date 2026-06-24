import * as Sentry from '@sentry/node';

// Initialize Sentry before bootstrapping the application
const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
  });
}

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ResponseInterceptor } from './modules/shared/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './modules/shared/filters/global-exception.filter';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { NormalizeInputPipe } from './modules/shared/pipes/normalize-input.pipe';
import { SanitizeHtmlPipe } from './modules/shared/pipes/sanitize-html.pipe';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  app.use(helmet());

  app.use(compression());
  app.use(cookieParser());

  if (isProduction) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
      } else {
        next();
      }
    });
  }

  app.setGlobalPrefix('api/v1');

  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalFilters(new GlobalExceptionFilter(config));
  app.useGlobalPipes(
    new NormalizeInputPipe(),
    new SanitizeHtmlPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const allowedOrigins = config
    .get<string>('ALLOWED_ORIGINS')
    ?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : !isProduction,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Idempotency-Key',
      'X-Request-Id',
    ],
  });

  const swaggerEnabled =
    !isProduction || config.get<boolean>('SWAGGER_ENABLED') === true;

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Nuts API — E-Commerce Platform')
      .setDescription(
        `## Overview

Production-ready REST API for the Nuts e-commerce platform. Handles multi-vendor marketplace operations including customer auth, shopping cart, checkout, payments via Paystack, creator store management, and full admin controls.

## Authentication

All authenticated endpoints use **httpOnly cookies** set during login/register. The \`access_token\` cookie is read automatically by the server. A Bearer token may be sent via the \`Authorization\` header as a fallback.

**Cookie-based auth (preferred):** The server sets \`access_token\` and \`refresh_token\` as httpOnly, secure, same-site cookies. These are sent automatically on every request.

**Bearer auth (fallback):** Click the "Authorize" button and paste your JWT token. This is useful for testing in Swagger UI.

### Auth flows
| Flow | Endpoints |
|------|-----------|
| Customer Auth | \`POST /api/v1/auth/register\`, \`/login\`, \`/refresh\`, \`/logout\` |
| Creator Auth | \`POST /api/v1/creators/register\`, \`/login\`, \`/refresh\`, \`/logout\` |
| Admin Auth | \`POST /api/v1/admin/auth/setup\`, \`/login\`, \`/refresh\`, \`/logout\` |

### Rate limiting
Sensitive endpoints (auth, OTP, checkout) have strict rate limits. Responses include \`Retry-After\` headers when throttled.`,
      )
      .setVersion('1.0.0')
      .addServer(
        `http://localhost:${config.getOrThrow<number>('PORT')}`,
        'Development server',
      )
      .addServer('https://api.nuts-commerce.com', 'Production server')
      .addTag(
        'ADMIN - ANALYTICS',
        'Admin analytics — summary, revenue, top products/creators/categories, funnel, activity audit',
      )
      .addTag(
        'ADMIN - AUTH',
        'Admin authentication — setup, login, logout, token refresh',
      )
      .addTag(
        'ADMIN - CATEGORY',
        'Admin category management — create, update, activate/deactivate, delete',
      )
      .addTag(
        'ADMIN - CREATORS',
        'Admin creator management — list, approve, verify, suspend, delete',
      )
      .addTag(
        'ADMIN - DISCOUNT CODES',
        'Admin discount code management — create platform-wide codes, list, deactivate, delete',
      )
      .addTag(
        'ADMIN - ORDERS',
        'Admin order management — list/filter all orders, update any order status',
      )
      .addTag(
        'ADMIN - PRODUCT VARIANTS',
        'Admin variant management — CRUD, stock, activate/deactivate for any variant',
      )
      .addTag(
        'ADMIN - PRODUCTS',
        'Admin product management — CRUD, stock, activate/deactivate for any product',
      )
      .addTag(
        'ADMIN - SEARCH',
        'Admin global search — search users, creators, products, orders, and discount codes',
      )
      .addTag(
        'ADMIN - USERS',
        'Admin user management — list, view, deactivate/reactivate, delete users',
      )
      .addTag(
        'AUTH',
        'Customer authentication — register, login, logout, refresh, password reset',
      )
      .addTag(
        'CART',
        'Shopping cart management — add/update/remove items, clear cart (authenticated)',
      )
      .addTag(
        'CATEGORIES',
        'Public category tree — browse the nested category hierarchy and resolve slug paths',
      )
      .addTag(
        'CREATOR - ANALYTICS',
        'Creator analytics — revenue, top products, performance metrics',
      )
      .addTag(
        'CREATOR - DISCOUNT CODES',
        'Creator discount code management — create, list, deactivate, delete codes',
      )
      .addTag(
        'CREATOR - ORDERS',
        'Creator order management — view orders containing your products, update fulfillment status',
      )
      .addTag(
        'CREATOR - PRODUCT VARIANTS',
        'Creator variant management — CRUD, stock adjustments, activate/deactivate',
      )
      .addTag(
        'CREATOR - PRODUCTS',
        'Creator product management — CRUD, stock adjustments, activate/deactivate',
      )
      .addTag(
        'CREATOR - WALLET',
        'Creator wallet — view balance, transaction history',
      )
      .addTag(
        'CREATORS - ACCOUNT',
        'Creator account management — view/update profile, deactivate, reactivate, delete account',
      )
      .addTag(
        'CREATORS - AUTH',
        'Creator authentication — register, login, logout, refresh, OTP, password reset',
      )
      .addTag(
        'HEALTH',
        'Application health and readiness checks — liveness probe, database connectivity',
      )
      .addTag(
        'ORDERS',
        'Customer order management — checkout, view orders, cancel, update shipping',
      )
      .addTag(
        'PAYMENTS',
        'Payment processing via Paystack — initialize, verify, webhooks, refunds',
      )
      .addTag(
        'PRODUCT VARIANTS',
        'Public product variant information — sizes, colors, stock per variant',
      )
      .addTag(
        'PRODUCTS',
        'Public product catalog — browse, search, filter by category/price/stock',
      )
      .addTag(
        'REVIEWS',
        'Product reviews — create, view by product, delete your own reviews',
      )
      .addTag(
        'SEARCH',
        'Global storefront search — products, autocomplete suggestions',
      )
      .addTag(
        'SHIPPING ADDRESSES',
        'Saved shipping address management — create, list, set default, delete',
      )
      .addTag(
        'USER WALLET',
        'User wallet — view balance, transaction history (authenticated)',
      )
      .addTag(
        'USERS',
        'Current user profile management — view, update, change password, deactivate/delete account',
      )
      .addTag(
        'WISHLIST',
        'Customer wishlist — add/remove products and variants, view wishlist',
      )
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Optional fallback. The server prefers httpOnly access_token cookies set during login. Use this header when cookies are unavailable (e.g., mobile clients).',
          in: 'header',
        },
        'JWT-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    });
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
      },
      customSiteTitle: 'Nuts API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
    });
    logger.log(' Swagger documentation available at /api/docs');
  }

  app.enableShutdownHooks();
  const port = config.get<number>('PORT');
  await app.listen(port!);
  logger.log(`Application running on port ${port} [${config.get('NODE_ENV')}]`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});
