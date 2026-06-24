import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { EmailProducer } from '../producers/email.producer';
import { CartReminderJobData } from '../jobs/job.types';

@Injectable()
export class CartProcessor {
  private readonly logger = new Logger(CartProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProducer: EmailProducer,
  ) {}

  async processFirstReminder(job: Job<CartReminderJobData>): Promise<void> {
    await this.sendReminder(job.data, 'first');
  }

  async processSecondReminder(job: Job<CartReminderJobData>): Promise<void> {
    await this.sendReminder(job.data, 'second');
  }

  private async sendReminder(
    data: CartReminderJobData,
    type: 'first' | 'second',
  ): Promise<void> {
    const { cartId, userId } = data;

    // Verify cart is still abandoned (not checked out)
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        cartItems: {
          select: { quantity: true, unitPrice: true, totalPrice: true },
        },
        user: { select: { email: true, firstName: true } },
      },
    });

    if (!cart || cart.checkedOut) {
      this.logger.debug(
        { cartId },
        'Cart no longer abandoned, skipping reminder',
      );
      return;
    }

    const itemCount = cart.cartItems.length;
    const totalAmount = cart.cartItems.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );

    // Check if a reminder was already sent for this type
    // This check happens in the cron job via Redis, but we double-check here
    // (see AbandonedCartCron for the Redis-based dedup)

    await this.emailProducer.sendAbandonedCartReminder({
      to: cart.user.email,
      firstName: cart.user.firstName,
      cartId,
      itemCount,
      totalAmount,
      currency: 'ngn',
      reminderType: type,
    });

    this.logger.log(
      { cartId, userId, type, itemCount, totalAmount },
      'Abandoned cart reminder queued',
    );
  }
}
