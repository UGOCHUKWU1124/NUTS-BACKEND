import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { EmailProducer } from 'src/modules/queue/producers/email.producer';
import { LOW_STOCK } from 'src/modules/shared/constants';
import { generateJobId } from 'src/modules/shared/utils';

@Injectable()
export class LowStockCron {
  private readonly logger = new Logger(LowStockCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProducer: EmailProducer,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  private formatVariantName(options: unknown): string {
    if (!options) return '';
    // New DB format: array of { name, value }
    if (Array.isArray(options)) {
      return (options as { name: string; value: string }[])
        .map((o) => o.value)
        .join(', ');
    }
    // Legacy DB format: object { size: "M", color: "Black" }
    if (typeof options === 'object') {
      return Object.values(options as Record<string, string>).join(', ');
    }
    return '';
  }

  /**
   * Runs daily to check for products with stock below threshold.
   */
  @Cron(LOW_STOCK.CRON_SCHEDULE, {
    name: 'low-stock-alert',
    timeZone: 'Africa/Lagos',
  })
  async handleLowStock(): Promise<void> {
    this.logger.log('Running low stock alert cron job...');

    const threshold = LOW_STOCK.THRESHOLD;
    const duplicateWindow = LOW_STOCK.DUPLICATE_WINDOW_HOURS * 3600; // seconds

    // Find products without variants with low stock
    const lowStockProducts = await this.prisma.product.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        hasVariants: false,
        stock: { gt: 0, lt: threshold },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        creatorId: true,
        creator: {
          select: { email: true, storeName: true },
        },
      },
    });

    // Find product variants with low stock
    const lowStockVariants = await this.prisma.productVariant.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        stock: { gt: 0, lt: threshold },
      },
      select: {
        id: true,
        options: true,
        stock: true,
        productId: true,
        product: {
          select: {
            name: true,
            creatorId: true,
            creator: {
              select: { email: true, storeName: true },
            },
          },
        },
      },
    });

    let alertsSent = 0;

    // Send alerts for products
    for (const product of lowStockProducts) {
      const dedupKey = `low-stock:alert:product:${product.id}`;
      const alreadySent = await this.redis.get(dedupKey);
      if (alreadySent) continue;

      await this.emailProducer.sendLowStockAlert(
        {
          to: product.creator.email,
          creatorStoreName: product.creator.storeName,
          productName: product.name,
          currentStock: product.stock,
        },
        {
          deduplication: {
            id: generateJobId('low-stock-product', product.id),
            ttl: duplicateWindow,
          },
        },
      );

      await this.redis.setex(dedupKey, duplicateWindow, '1');
      alertsSent++;
    }

    // Send alerts for variants
    for (const variant of lowStockVariants) {
      const product = variant.product;
      const dedupKey = `low-stock:alert:variant:${variant.id}`;
      const alreadySent = await this.redis.get(dedupKey);
      if (alreadySent) continue;

      await this.emailProducer.sendLowStockAlert(
        {
          to: product.creator.email,
          creatorStoreName: product.creator.storeName,
          productName: product.name,
          currentStock: variant.stock,
          variantName: variant.options
            ? this.formatVariantName(variant.options)
            : undefined,
        },
        {
          deduplication: {
            id: generateJobId('low-stock-variant', variant.id),
            ttl: duplicateWindow,
          },
        },
      );

      await this.redis.setex(dedupKey, duplicateWindow, '1');
      alertsSent++;
    }

    this.logger.log(
      `Low stock alert cron complete: ${alertsSent} alerts sent (${lowStockProducts.length} products, ${lowStockVariants.length} variants below threshold)`,
    );
  }
}
