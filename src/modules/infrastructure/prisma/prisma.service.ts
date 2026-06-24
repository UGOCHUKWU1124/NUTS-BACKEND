import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly slowQueryMs: number;
  private readonly isProduction: boolean;

  constructor(
    config: ConfigService,
    @InjectPinoLogger(PrismaService.name) private readonly logger: PinoLogger,
  ) {
    const connectionString = config.getOrThrow<string>('POSTGRESQL_URL');
    const adapter = new PrismaPg({ connectionString });

    super({
      adapter,
      log:
        config.get<string>('NODE_ENV') !== 'production'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'query' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
    });

    this.isProduction = config.get<string>('NODE_ENV') === 'production';
    this.slowQueryMs = config.getOrThrow<number>('PRISMA_SLOW_QUERY_MS');
  }

  async onModuleInit() {
    this.$on('query' as never, (event: Prisma.QueryEvent) => {
      if (event.duration >= this.slowQueryMs) {
        this.logger.warn(
          {
            durationMs: event.duration,
            query: event.query,
            params: event.params,
          },
          `Slow query (${event.duration}ms)`,
        );
      }
    });

    await this.$connect();
    this.logger.info('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.info('Database disconnected');
  }

  async cleanDatabase() {
    if (this.isProduction) {
      throw new Error('Not allowed to clean database in production');
    }

    const delegates: Array<{ deleteMany: () => Promise<unknown> }> = [
      this.orderStatusHistory,
      this.checkoutIdempotency,
      this.cartItem,
      this.cart,
      this.orderItem,
      this.order,
      this.payment,
      this.product,
      this.category,
      this.user,
    ];

    for (const delegate of delegates) {
      await delegate.deleteMany();
    }
  }
}
