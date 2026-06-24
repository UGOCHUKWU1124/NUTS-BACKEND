import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/modules/shared/interceptors/response.interceptor';
import cookieParser from 'cookie-parser';

describe('Nuts API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health', () => {
    it('GET /api/v1/health returns ok', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            success: boolean;
            data: { status: string };
          };
          expect(body.success).toBe(true);
          expect(body.data.status).toBe('ok');
        });
    });
  });

  describe('auth', () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    it('POST /api/v1/auth/register creates a user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password,
          firstName: 'E2E',
          lastName: 'User',
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as {
            success: boolean;
            data: { user: { email: string }; token: string };
          };
          expect(body.success).toBe(true);
          expect(body.data.user.email).toBe(email);
          expect(body.data.token).toBeDefined();
        });
    });

    it('POST /api/v1/auth/login returns session', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200)
        .expect((res) => {
          const body = res.body as {
            success: boolean;
            data: { token: string };
          };
          expect(body.success).toBe(true);
          expect(body.data.token).toBeDefined();
        });
    });
  });

  describe('category', () => {
    it('GET /api/v1/category lists root categories', () => {
      return request(app.getHttpServer())
        .get('/api/v1/category')
        .query({ categoryId: 'null', limit: 5 })
        .expect(200)
        .expect((res) => {
          const body = res.body as { success: boolean; data: unknown };
          expect(body.success).toBe(true);
          expect(Array.isArray(body.data)).toBe(true);
        });
    });
  });
});
