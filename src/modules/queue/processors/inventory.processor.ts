import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailProducer } from '../producers/email.producer';
import { LowStockCheckJobData } from '../jobs/job.types';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { LOW_STOCK } from 'src/modules/shared/constants';

@Injectable()
export class InventoryProcessor {
  private readonly logger = new Logger(InventoryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProducer: EmailProducer,
  ) {}

  async processLowStockCheck(job: Job<LowStockCheckJobData>): Promise<void> {
    const { productId, creatorId } = job.data;

    // Verify stock is still low
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        name: true,
        stock: true,
        hasVariants: true,
        creator: { select: { email: true, storeName: true } },
      },
    });

    if (!product || product.stock >= LOW_STOCK.THRESHOLD) {
      this.logger.debug({ productId }, 'Stock no longer low, skipping alert');
      return;
    }

    await this.emailProducer.sendLowStockAlert({
      to: product.creator.email,
      creatorStoreName: product.creator.storeName,
      productName: product.name,
      currentStock: product.stock,
    });

    this.logger.log(
      { productId, creatorId, stock: product.stock },
      'Low stock alert queued',
    );
  }
}
