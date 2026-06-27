import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { EmailProducer } from 'src/modules/queue/producers/email.producer';
import { ABANDONED_CART } from 'src/modules/shared/constants';
import { generateJobId } from 'src/modules/shared/utils';

@Injectable()
export class AbandonedCartCron {
  private readonly logger = new Logger(AbandonedCartCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProducer: EmailProducer,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Runs every hour to find abandoned carts and send reminders.
   */
  @Cron(ABANDONED_CART.CRON_SCHEDULE, {
    name: 'abandoned-cart-reminder',
    timeZone: 'Africa/Lagos',
  })
  async handleAbandonedCarts(): Promise<void> {
    this.logger.log('Running abandoned cart cron job...');
    const now = new Date();

    // ── First Reminder: carts with last activity > 2 hours ──────────
    const firstThreshold = new Date(
      now.getTime() - ABANDONED_CART.FIRST_REMINDER_HOURS * 60 * 60 * 1000,
    );

    const firstReminderCarts = await this.prisma.cart.findMany({
      where: {
        checkedOut: false,
        updatedAt: { lte: firstThreshold },
        cartItems: { some: {} },
      },
      include: {
        cartItems: {
          select: { quantity: true, unitPrice: true, totalPrice: true },
        },
        user: {
          select: { id: true, email: true, firstName: true },
        },
      },
    });

    for (const cart of firstReminderCarts) {
      // Dedup: check if already sent first reminder for this cart
      const dedupKey = `cart:reminder:${cart.id}:first`;
      const alreadySent = await this.redis.get(dedupKey);
      if (alreadySent) continue;

      const itemCount = cart.cartItems.length;
      const totalAmount = cart.cartItems.reduce(
        (sum, item) => sum + Number(item.totalPrice),
        0,
      );

      await this.emailProducer.sendAbandonedCartReminder(
        {
          to: cart.user.email,
          firstName: cart.user.firstName,
          cartId: cart.id,
          itemCount,
          totalAmount,
          currency: 'ngn',
          reminderType: 'first',
        },
        {
          deduplication: {
            id: generateJobId('abandoned-cart-first', cart.id),
            ttl: 86400,
          },
        },
      );

      // Mark as sent with TTL matching the second reminder window
      await this.redis.setex(
        dedupKey,
        ABANDONED_CART.SECOND_REMINDER_HOURS * 3600,
        '1',
      );

      this.logger.debug(
        { cartId: cart.id, userId: cart.user.id, itemCount, totalAmount },
        'First abandoned cart reminder sent',
      );
    }

    // ── Second Reminder: carts with last activity > 24 hours ─────────
    const secondThreshold = new Date(
      now.getTime() - ABANDONED_CART.SECOND_REMINDER_HOURS * 60 * 60 * 1000,
    );

    const secondReminderCarts = await this.prisma.cart.findMany({
      where: {
        checkedOut: false,
        updatedAt: { lte: secondThreshold },
        cartItems: { some: {} },
        // Only carts that received first reminder already
        // (implied by the updatedAt threshold covering the first window)
      },
      include: {
        cartItems: {
          select: { quantity: true, unitPrice: true, totalPrice: true },
        },
        user: {
          select: { id: true, email: true, firstName: true },
        },
      },
    });

    for (const cart of secondReminderCarts) {
      // Only send second reminder if the first one was already sent.
      // A cart inactive for > 24 h also satisfies the first-reminder threshold,
      // so without this guard both reminders would fire in the same cron run.
      const firstSentKey = `cart:reminder:${cart.id}:first`;
      const firstWasSent = await this.redis.get(firstSentKey);
      if (!firstWasSent) continue;

      const dedupKey = `cart:reminder:${cart.id}:second`;
      const alreadySent = await this.redis.get(dedupKey);
      if (alreadySent) continue;

      const itemCount = cart.cartItems.length;
      const totalAmount = cart.cartItems.reduce(
        (sum, item) => sum + Number(item.totalPrice),
        0,
      );

      await this.emailProducer.sendAbandonedCartReminder(
        {
          to: cart.user.email,
          firstName: cart.user.firstName,
          cartId: cart.id,
          itemCount,
          totalAmount,
          currency: 'ngn',
          reminderType: 'second',
        },
        {
          deduplication: {
            id: generateJobId('abandoned-cart-second', cart.id),
            ttl: 86400,
          },
        },
      );

      // Mark with longer TTL (7 days) to prevent re-sending
      await this.redis.setex(dedupKey, 7 * 86400, '1');

      this.logger.debug(
        { cartId: cart.id, userId: cart.user.id, itemCount, totalAmount },
        'Second abandoned cart reminder sent',
      );
    }

    this.logger.log(
      `Abandoned cart cron complete: ${firstReminderCarts.length} first reminders, ${secondReminderCarts.length} second reminders`,
    );
  }
}
