import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEvents } from 'src/modules/shared/events/domain-events';
import type {
  OrderProcessingPayload,
  OrderShippedPayload,
  OrderDeliveredPayload,
  OrderCancelledPayload,
  PaymentConfirmedPayload,
  PaymentFailedPayload,
  ReferralRewardCreditedPayload,
} from 'src/modules/shared/events/event-payloads';
import { EmailProducer } from 'src/modules/queue/producers/email.producer';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { generateJobId } from 'src/modules/shared/utils';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly emailProducer: EmailProducer,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Extracts ProductVariant.options (stored as a JSON array of {name, value} pairs)
   * into a raw array for EmailOrderItem.variantOptions.
   */
  private formatVariantOptions(
    options: unknown,
  ): { name: string; value: string }[] | undefined {
    if (!options) return undefined;
    if (Array.isArray(options)) {
      return options as { name: string; value: string }[];
    }
    if (typeof options === 'object' && options !== null) {
      return Object.entries(options as Record<string, string>).map(
        ([name, value]) => ({ name, value }),
      );
    }
    return undefined;
  }

  @OnEvent(DomainEvents.ORDER_PROCESSING)
  async handleOrderProcessing(payload: OrderProcessingPayload): Promise<void> {
    this.logger.log(
      { orderId: payload.orderId },
      'Order processing event received',
    );

    // 1. Send detailed confirmation to the customer using payload data
    await this.emailProducer.sendOrderConfirmation(
      {
        to: payload.userEmail,
        orderNumber: payload.orderNumber,
        customerName: payload.userFirstName || 'Valued Customer',
        items: payload.items.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          variantOptions: item.variantOptions,
        })),
        totalAmount: payload.totalAmount,
        discountAmount: 0,
        finalAmount: payload.finalAmount,
        currency: payload.currency,
        shippingAddress: payload.shippingAddress,
      },
      {
        deduplication: {
          id: generateJobId('order-confirmation', payload.orderId),
          ttl: 86400,
        },
      },
    );

    // 2. Fetch order items with variant info for per-creator notifications
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        orderItems: {
          include: {
            product: { select: { name: true } },
            variant: { select: { options: true } },
            creator: { select: { email: true, storeName: true } },
          },
        },
      },
    });

    if (!order) return;

    // Group items by creator so each creator gets a single notification
    // with all their items instead of one email per item
    const creatorItemsMap = new Map<string, typeof order.orderItems>();
    for (const item of order.orderItems) {
      const existing = creatorItemsMap.get(item.creatorId) || [];
      existing.push(item);
      creatorItemsMap.set(item.creatorId, existing);
    }

    for (const [creatorId, items] of creatorItemsMap) {
      const creator = items[0].creator;
      const creatorTotal = items.reduce(
        (sum, i) => sum + Number(i.totalPrice),
        0,
      );

      await this.emailProducer.sendNewOrderToCreator(
        {
          to: creator.email,
          creatorStoreName: creator.storeName,
          orderNumber: payload.orderNumber,
          customerName: payload.userFirstName || 'Customer',
          items: items.map((item) => ({
            productName: item.product.name,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            totalPrice: Number(item.totalPrice),
            variantOptions: item.variant
              ? this.formatVariantOptions(item.variant.options)
              : undefined,
          })),
          totalAmount: creatorTotal,
          orderTotalForCreator: creatorTotal,
          currency: payload.currency,
        },
        {
          deduplication: {
            id: generateJobId('creator-order', payload.orderId, creatorId),
            ttl: 86400,
          },
        },
      );
    }
  }

  @OnEvent(DomainEvents.ORDER_SHIPPED)
  async handleOrderShipped(payload: OrderShippedPayload): Promise<void> {
    this.logger.log(
      { orderId: payload.orderId },
      'Order shipped event received',
    );

    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        orderItems: {
          include: {
            product: { select: { name: true } },
            variant: { select: { options: true } },
          },
        },
      },
    });

    if (!order) return;

    const payment = await this.prisma.payment.findFirst({
      where: { orderId: payload.orderId },
      select: { currency: true },
    });

    await this.emailProducer.sendOrderShipped(
      {
        to: payload.userEmail,
        orderNumber: payload.orderNumber,
        customerName: payload.userFirstName || 'Valued Customer',
        items: order.orderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          variantOptions: item.variant
            ? this.formatVariantOptions(item.variant.options)
            : undefined,
        })),
        trackingNumber: payload.trackingNumber,
        shippingAddress: order.shippingAddress || '',
        currency: payment?.currency || 'NGN',
      },
      {
        deduplication: {
          id: generateJobId('order-shipped', payload.orderId),
          ttl: 86400,
        },
      },
    );
  }

  @OnEvent(DomainEvents.ORDER_DELIVERED)
  async handleOrderDelivered(payload: OrderDeliveredPayload): Promise<void> {
    this.logger.log(
      { orderId: payload.orderId },
      'Order delivered event received',
    );

    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        orderItems: {
          include: {
            product: { select: { name: true } },
            variant: { select: { options: true } },
          },
        },
      },
    });

    if (!order) return;

    const payment = await this.prisma.payment.findFirst({
      where: { orderId: payload.orderId },
      select: { currency: true },
    });

    await this.emailProducer.sendOrderDelivered(
      {
        to: payload.userEmail,
        orderNumber: payload.orderNumber,
        customerName: payload.userFirstName || 'Valued Customer',
        items: order.orderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          variantOptions: item.variant
            ? this.formatVariantOptions(item.variant.options)
            : undefined,
        })),
        currency: payment?.currency || 'NGN',
      },
      {
        deduplication: {
          id: generateJobId('order-delivered', payload.orderId),
          ttl: 86400,
        },
      },
    );
  }

  @OnEvent(DomainEvents.ORDER_CANCELLED)
  async handleOrderCancelled(payload: OrderCancelledPayload): Promise<void> {
    this.logger.log(
      { orderId: payload.orderId },
      'Order cancelled event received',
    );

    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        orderItems: {
          include: {
            product: { select: { name: true } },
            variant: { select: { options: true } },
          },
        },
      },
    });

    if (!order) return;

    const payment = await this.prisma.payment.findFirst({
      where: { orderId: payload.orderId },
      select: { currency: true },
    });

    await this.emailProducer.sendOrderCancelled(
      {
        to: payload.userEmail,
        orderNumber: payload.orderNumber,
        customerName: payload.userFirstName || 'Valued Customer',
        items: order.orderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          variantOptions: item.variant
            ? this.formatVariantOptions(item.variant.options)
            : undefined,
        })),
        reason: payload.reason,
        refundProcessed: payload.refundProcessed,
        currency: payment?.currency || 'NGN',
      },
      {
        deduplication: {
          id: generateJobId('order-cancelled', payload.orderId),
          ttl: 86400,
        },
      },
    );
  }

  @OnEvent(DomainEvents.PAYMENT_CONFIRMED)
  async handlePaymentConfirmed(
    payload: PaymentConfirmedPayload,
  ): Promise<void> {
    this.logger.log(
      { paymentId: payload.paymentId },
      'Payment confirmed event received',
    );

    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        orderItems: {
          include: {
            product: { select: { name: true } },
            variant: { select: { options: true } },
          },
        },
      },
    });

    if (!order) return;

    await this.emailProducer.sendPaymentConfirmed(
      {
        to: payload.userEmail,
        orderNumber: payload.orderNumber,
        customerName: payload.userFirstName || 'Valued Customer',
        items: order.orderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          variantOptions: item.variant
            ? this.formatVariantOptions(item.variant.options)
            : undefined,
        })),
        amount: payload.amount,
        currency: payload.currency,
        paymentReference: payload.paymentReference,
      },
      {
        deduplication: {
          id: generateJobId('payment-confirmed', payload.paymentId),
          ttl: 86400,
        },
      },
    );
  }

  @OnEvent(DomainEvents.PAYMENT_FAILED)
  async handlePaymentFailed(payload: PaymentFailedPayload): Promise<void> {
    this.logger.log(
      { paymentId: payload.paymentId },
      'Payment failed event received',
    );

    await this.emailProducer.sendPaymentFailed(
      {
        to: payload.userEmail,
        orderNumber: payload.orderNumber,
        customerName: payload.userFirstName || 'Valued Customer',
        reason: payload.reason,
      },
      {
        deduplication: {
          id: generateJobId('payment-failed', payload.paymentId),
          ttl: 86400,
        },
      },
    );
  }

  @OnEvent(DomainEvents.REFERRAL_REWARD_CREDITED)
  async handleReferralReward(
    payload: ReferralRewardCreditedPayload,
  ): Promise<void> {
    this.logger.log(
      { referralId: payload.referralId },
      'Referral reward event received',
    );

    // The payload doesn't carry a currency field, but the email data type requires one.
    // Default to NGN (the schema default) since referral rewards are not order-specific.
    await this.emailProducer.sendReferralReward(
      {
        to: payload.referrerEmail,
        referrerName: payload.referrerName,
        rewardAmount: payload.rewardAmount,
        currency: 'NGN',
      },
      {
        deduplication: {
          id: generateJobId('referral-reward', payload.referralId),
          ttl: 86400,
        },
      },
    );
  }
}
