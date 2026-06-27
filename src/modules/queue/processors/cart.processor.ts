import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { CartReminderJobData } from '../jobs/job.types';

@Injectable()
export class CartProcessor {
  private readonly logger = new Logger(CartProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async processFirstReminder(job: Job<CartReminderJobData>): Promise<void> {
    await this.logReminder(job.data, 'first');
  }

  async processSecondReminder(job: Job<CartReminderJobData>): Promise<void> {
    await this.logReminder(job.data, 'second');
  }

  /**
   * Abandoned cart reminder emails are sent directly by AbandonedCartCron via
   * EmailProducer (with Redis-based deduplication). This processor handles any
   * cart queue jobs that are NOT email sends — e.g. future cart-cleanup tasks.
   * Sending emails here would bypass the Redis dedup and cause duplicates.
   */
  private async logReminder(
    data: CartReminderJobData,
    type: 'first' | 'second',
  ): Promise<void> {
    const { cartId, userId } = data;

    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      select: { checkedOut: true },
    });

    if (!cart || cart.checkedOut) {
      this.logger.debug(
        { cartId },
        'Cart no longer abandoned — skipping processor reminder log',
      );
      return;
    }

    this.logger.log(
      { cartId, userId, type },
      'Cart reminder job processed (email sent by cron)',
    );
  }
}
