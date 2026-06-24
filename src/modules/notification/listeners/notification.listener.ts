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

  @OnEvent(DomainEvents.ORDER_PROCESSING)
  async handleOrderProcessing(payload: OrderProcessingPayload): Promise<void> {
    this.logger.log(
      { orderId: payload.orderId },
      'Order processing event received',
    );

    // Send confirmation to customer
    await this.emailProducer.sendOrderConfirmation(
      {
        to: payload.userEmail,
        orderNumber: payload.orderNumber,
        customerName: payload.userFirstName || 'Customer',
        items: [], // items will be populated from order data
        totalAmount: payload.totalAmount,
        discountAmount: 0,
        finalAmount: payload.finalAmount,
        currency: payload.currency,
        shippingAddress: '',
      },
      {
        deduplication: {
          id: generateJobId('order-confirmation', payload.orderId),
          ttl: 86400,
        },
      },
    );

    // Notify each creator about the new order
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        orderItems: {
          include: {
            product: { select: { name: true } },
            creator: { select: { email: true, storeName: true } },
          },
        },
      },
    });

    if (order) {
      for (const item of order.orderItems) {
        await this.emailProducer.sendNewOrderToCreator(
          {
            to: item.creator.email,
            creatorStoreName: item.creator.storeName,
            orderNumber: payload.orderNumber,
            customerName: payload.userFirstName || 'Customer',
            items: [
              {
                productName: item.product.name,
                quantity: item.quantity,
                price: Number(item.unitPrice),
              },
            ],
            totalAmount: Number(item.totalPrice),
            currency: payload.currency,
          },
          {
            deduplication: {
              id: generateJobId(
                'creator-order',
                payload.orderId,
                item.creatorId,
              ),
              ttl: 86400,
            },
          },
        );
      }
    }
  }

  @OnEvent(DomainEvents.ORDER_SHIPPED)
  async handleOrderShipped(payload: OrderShippedPayload): Promise<void> {
    this.logger.log(
      { orderId: payload.orderId },
      'Order shipped event received',
    );

    await this.emailProducer.sendEmail(
      {
        to: payload.userEmail,
        subject: `Your Order #${payload.orderNumber} Has Shipped!`,
        html: '', // template will be rendered
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

    await this.emailProducer.sendEmail(
      {
        to: payload.userEmail,
        subject: `Your Order #${payload.orderNumber} Has Been Delivered`,
        html: '',
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

    await this.emailProducer.sendEmail(
      {
        to: payload.userEmail,
        subject: `Order #${payload.orderNumber} Cancelled`,
        html: '',
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

    // Send receipt to customer
    await this.emailProducer.sendEmail(
      {
        to: payload.userEmail,
        subject: `Payment Confirmed - Order #${payload.orderNumber}`,
        html: '',
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
        subject: `Payment Failed - Order #${payload.orderNumber}`,
        html: '',
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

    await this.emailProducer.sendReferralReward(
      {
        to: payload.referrerEmail,
        subject: 'You Earned a Referral Reward!',
        html: '',
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
