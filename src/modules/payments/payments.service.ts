import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { UsersService } from 'src/modules/users/users.service';
import { EmailService } from 'src/modules/infrastructure/mail/email.service';
import { WalletService } from 'src/modules/wallet/wallet.service';
import { ReferralService } from 'src/modules/referral/referral.service';
import { generateStatusNote } from 'src/modules/orders/constants/order-status.constants';
import { DomainEvents } from 'src/modules/shared/events/domain-events';
import type { OrderProcessingPayload } from 'src/modules/shared/events/event-payloads';
import {
  PAYSTACK_SUCCESS_STATUS,
  PAYSTACK_TRANSACTION_INI_URL,
  PAYSTACK_TRANSACTION_VERIFY_BASE_URL,
  PAYSTACK_WEBHOOK_CRYPTO_ALGO,
} from 'src/modules/shared/constants/payment.constants';
import {
  InitializePaymentResponseDto,
  PaymentResponseDto,
} from './dto/payment-response.dto';
import type {
  PaystackApiResponse,
  PaystackInitializeData,
  PaystackInitializePayload,
  PaystackVerifyData,
  PaystackWebhookEvent,
} from './types/paystack.types';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly walletService: WalletService,
    private readonly referralService: ReferralService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async initializeForOrder(
    userId: string,
    orderId: string,
  ): Promise<InitializePaymentResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    this.assertPaystackConfigured();

    const payment = await this.prisma.payment.findFirst({
      where: { orderId, userId },
      include: {
        order: { select: { status: true, orderNumber: true } },
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    if (payment.order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay for a cancelled order');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Order is already paid');
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('Payment was refunded');
    }

    if (payment.paymentLink && payment.transactionReference) {
      return {
        authorizationUrl: payment.paymentLink,
        reference: payment.transactionReference,
        paymentId: payment.id,
      };
    }

    const amountKobo = this.toPaystackAmount(Number(payment.amount));
    const reference = payment.transactionReference ?? this.generateReference();

    const payload: PaystackInitializePayload = {
      email: payment.user.email,
      amount: amountKobo,
      currency: payment.currency.toUpperCase(),
      reference,
      metadata: {
        order_id: orderId,
        order_number: payment.order.orderNumber,
        user_id: userId,
        custom_fields: [
          {
            display_name: 'Order',
            variable_name: 'order_number',
            value: payment.order.orderNumber,
          },
        ],
      },
    };

    const callbackUrl = this.config.get<string>('PAYSTACK_CALLBACK_URL');
    if (callbackUrl) {
      payload.callback_url = callbackUrl;
    }

    const result = await this.paystackPost<
      PaystackApiResponse<PaystackInitializeData>
    >(PAYSTACK_TRANSACTION_INI_URL, payload);

    if (!result.status || !result.data?.authorization_url) {
      throw new ServiceUnavailableException(
        result.message || 'Paystack initialization failed',
      );
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        transactionReference: result.data.reference,
        paymentLink: result.data.authorization_url,
        paymentMethod: 'paystack',
      },
    });

    return {
      authorizationUrl: result.data.authorization_url,
      reference: result.data.reference,
      paymentId: payment.id,
    };
  }

  async verifyByReference(reference: string): Promise<PaymentResponseDto> {
    this.assertPaystackConfigured();
    const payment = await this.confirmPayment(reference);
    if (!payment) {
      throw new NotFoundException('Payment not found or verification failed');
    }
    return payment;
  }

  async handleWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<void> {
    this.assertPaystackConfigured();

    if (!signature || !this.isValidWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid Paystack webhook signature');
    }

    let event: PaystackWebhookEvent;
    try {
      event = JSON.parse(rawBody) as PaystackWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const reference = event.data?.reference;
    if (!reference) {
      return;
    }

    if (
      event.event === 'charge.success' ||
      event.data?.status === PAYSTACK_SUCCESS_STATUS
    ) {
      await this.confirmPayment(reference);
      return;
    }

    if (event.event === 'charge.failed') {
      await this.markPaymentFailed(reference);
    }
  }

  async findByOrder(
    userId: string,
    orderId: string,
  ): Promise<PaymentResponseDto> {
    await this.usersService.assertActiveAccount(userId);
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.toResponse(payment);
  }

  async getPaymentOtpContext(
    userId: string,
    orderId: string,
  ): Promise<{ orderNumber: string; amount: number; currency: string }> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, userId },
      include: { order: { select: { orderNumber: true, status: true } } },
    });

    if (!payment || !payment.order) {
      throw new NotFoundException('Payment not found for this order');
    }

    if (payment.order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot request OTP for a cancelled order');
    }

    return {
      orderNumber: payment.order.orderNumber,
      amount: Number(payment.amount),
      currency: payment.currency.toUpperCase(),
    };
  }

  async refund(
    paymentId: string,
    adminId: string,
    amount?: number,
  ): Promise<PaymentResponseDto> {
    this.assertPaystackConfigured();

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    const transaction = payment.transactionId || payment.transactionReference;
    if (!transaction) {
      throw new BadRequestException(
        'Transaction reference or ID is missing from payment',
      );
    }

    const refundAmount = amount ? amount : Number(payment.amount);
    if (refundAmount <= 0 || refundAmount > Number(payment.amount)) {
      throw new BadRequestException('Invalid refund amount');
    }

    const payload = {
      transaction,
      amount: this.toPaystackAmount(refundAmount),
    };

    try {
      const response = await this.paystackPost<{
        status: boolean;
        message: string;
      }>('https://api.paystack.co/refund', payload);

      if (!response.status) {
        throw new ServiceUnavailableException(
          response.message || 'Refund failed on Paystack',
        );
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const pay = await tx.payment.update({
          where: { id: paymentId },
          data: { status: PaymentStatus.REFUNDED },
        });

        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
          include: { orderItems: true },
        });

        if (order) {
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.CANCELLED, stockRestored: true },
          });

          for (const item of order.orderItems) {
            if (item.variantId) {
              const v = await tx.productVariant.findFirst({
                where: { id: item.variantId },
                select: { id: true, stock: true, productId: true },
              });
              if (v) {
                const oldStock = v.stock;
                const newStock = v.stock + item.quantity;
                await tx.productVariant.update({
                  where: { id: item.variantId },
                  data: { stock: newStock },
                });
                await tx.stockHistory.create({
                  data: {
                    productId: v.productId,
                    variantId: item.variantId,
                    adjustment: item.quantity,
                    oldStockQuantity: oldStock,
                    newStockQuantity: newStock,
                    description: 'Stock restored (payment refunded)',
                  },
                });
              }
            } else {
              const prod = await tx.product.findFirst({
                where: { id: item.productId },
                select: { id: true, stock: true },
              });
              if (prod) {
                const oldStock = prod.stock;
                await tx.product.update({
                  where: { id: item.productId },
                  data: { stock: { increment: item.quantity } },
                });
                await tx.stockHistory.create({
                  data: {
                    productId: item.productId,
                    adjustment: item.quantity,
                    oldStockQuantity: oldStock,
                    newStockQuantity: oldStock + item.quantity,
                    description: 'Stock restored (payment refunded)',
                  },
                });
              }
            }
          }

          // Reverse pending creator earnings (only what is still pending, not already settled)
          const creatorEarnings = new Map<string, Prisma.Decimal>();
          for (const item of order.orderItems) {
            const earning = new Prisma.Decimal(
              Number(
                (Number(item.unitPrice) * item.quantity * 0.85).toFixed(2),
              ),
            );
            const existing =
              creatorEarnings.get(item.creatorId) ?? new Prisma.Decimal(0);
            creatorEarnings.set(item.creatorId, existing.add(earning));
          }

          for (const [creatorId, earning] of creatorEarnings) {
            await this.walletService.debitCreatorPending(
              creatorId,
              earning,
              payment.orderId,
              tx,
            );
          }
        }

        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            fromStatus: payment.order.status,
            toStatus: OrderStatus.CANCELLED,
            changedByAdminId: adminId,
            note: generateStatusNote({
              fromStatus: payment.order.status,
              toStatus: OrderStatus.CANCELLED,
              changedByAdminId: adminId,
              manualNote: `Refund of ${refundAmount} initiated`,
            }),
          },
        });

        return pay;
      });

      return this.toResponse(updated);
    } catch (err) {
      this.logger.error(`Refund failed for payment ${paymentId}`, err);
      throw err;
    }
  }

  private async confirmPayment(
    reference: string,
  ): Promise<PaymentResponseDto | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { transactionReference: reference },
    });

    if (!payment) {
      return null;
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return this.toResponse(payment);
    }

    const verified = await this.paystackVerify(reference);
    if (!verified?.status || verified.data.status !== PAYSTACK_SUCCESS_STATUS) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      return null;
    }

    let orderMoved = false;

    const updated = await this.prisma.$transaction(async (tx) => {
      const completed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          transactionId: String(verified.data.id ?? reference),
          paymentMethod: 'paystack',
        },
      });

      const orderUpdated = await tx.order.updateMany({
        where: { id: payment.orderId, status: OrderStatus.PENDING },
        data: { status: OrderStatus.PROCESSING },
      });

      if (orderUpdated.count > 0) {
        orderMoved = true;

        await tx.orderStatusHistory.create({
          data: {
            orderId: payment.orderId,
            fromStatus: OrderStatus.PENDING,
            toStatus: OrderStatus.PROCESSING,
            note: generateStatusNote({
              fromStatus: OrderStatus.PENDING,
              toStatus: OrderStatus.PROCESSING,
            }),
          },
        });

        // Credit creator pending earnings for each creator in the order
        const orderWithItems = await tx.order.findUnique({
          where: { id: payment.orderId },
          include: { orderItems: true },
        });

        if (orderWithItems) {
          // Group items by creatorId and calculate earnings
          const creatorEarnings = new Map<string, Prisma.Decimal>();
          for (const item of orderWithItems.orderItems) {
            const earning = new Prisma.Decimal(
              Number(
                (Number(item.unitPrice) * item.quantity * 0.85).toFixed(2),
              ),
            );
            const existing =
              creatorEarnings.get(item.creatorId) ?? new Prisma.Decimal(0);
            creatorEarnings.set(item.creatorId, existing.add(earning));
          }

          for (const [creatorId, earning] of creatorEarnings) {
            await this.walletService.creditCreatorPending(
              creatorId,
              earning,
              payment.orderId,
              tx,
            );
          }
        }
      }

      return completed;
    });

    this.sendPaymentReceiptEmail(updated.id).catch((err) => {
      this.logger.error(
        `Background sendPaymentReceiptEmail failed for payment ${updated.id}`,
        err,
      );
    });

    if (orderMoved) {
      this.emitOrderProcessingEvent(updated.orderId).catch((err) => {
        this.logger.error(
          `Background emitOrderProcessingEvent failed for order ${updated.orderId}`,
          err,
        );
      });
    }

    return this.toResponse(updated);
  }

  private async markPaymentFailed(reference: string): Promise<void> {
    await this.prisma.payment.updateMany({
      where: {
        transactionReference: reference,
        status: PaymentStatus.PENDING,
      },
      data: { status: PaymentStatus.FAILED },
    });
  }

  private async paystackVerify(
    reference: string,
  ): Promise<PaystackApiResponse<PaystackVerifyData> | null> {
    const url = `${PAYSTACK_TRANSACTION_VERIFY_BASE_URL}/${encodeURIComponent(reference)}`;
    try {
      return await this.paystackGet<PaystackApiResponse<PaystackVerifyData>>(
        url,
      );
    } catch (error) {
      this.logger.error('Paystack verify failed', error);
      return null;
    }
  }

  private async paystackPost<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.paystackHeaders(),
      body: JSON.stringify(body),
    });
    return this.parsePaystackResponse<T>(response);
  }

  private async paystackGet<T>(url: string): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: this.paystackHeaders(),
    });
    return this.parsePaystackResponse<T>(response);
  }

  private paystackHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
    };
  }

  private async parsePaystackResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new ServiceUnavailableException('Invalid Paystack API response');
    }
    if (!response.ok) {
      const message =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message
          : `Paystack error (${response.status})`;
      throw new ServiceUnavailableException(message);
    }
    return data;
  }

  private isValidWebhookSignature(rawBody: string, signature: string): boolean {
    try {
      const hash = createHmac(
        PAYSTACK_WEBHOOK_CRYPTO_ALGO,
        this.config.getOrThrow<string>('PAYSTACK_SECRET_KEY'),
      )
        .update(rawBody)
        .digest('hex');

      const sigBuffer = Buffer.from(signature);
      const hashBuffer = Buffer.from(hash);
      if (sigBuffer.length !== hashBuffer.length) return false;
      return timingSafeEqual(sigBuffer, hashBuffer);
    } catch {
      return false;
    }
  }

  private assertPaystackConfigured(): void {
    const key = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!key?.trim()) {
      throw new InternalServerErrorException('Paystack is not configured');
    }
  }

  private toPaystackAmount(amountMajor: number): number {
    return Math.round(amountMajor * 100);
  }

  private generateReference(): string {
    return `nuts_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private toResponse(
    payment: Prisma.PaymentGetPayload<object>,
  ): PaymentResponseDto {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      transactionReference: payment.transactionReference,
      paymentLink: payment.paymentLink,
      paymentMethod: payment.paymentMethod,
      createdAt: payment.createdAt,
    };
  }

  /**
   * Fetches the confirmed order's user and item details then emits
   * ORDER_PROCESSING so the NotificationListener can send:
   *   - customer order-processing confirmation (via queue)
   *   - per-creator new-order notification (via queue)
   */
  private async emitOrderProcessingEvent(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { id: true, email: true, firstName: true } },
          payment: { select: { currency: true } },
          orderItems: {
            include: {
              product: { select: { name: true } },
              variant: { select: { options: true } },
            },
          },
        },
      });

      if (!order || !order.user || !order.payment) return;

      const payload: OrderProcessingPayload = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        userEmail: order.user.email,
        userFirstName: order.user.firstName,
        totalAmount: Number(order.totalAmount),
        finalAmount: Number(order.finalAmount),
        currency: order.payment.currency,
        creatorIds: [
          ...new Set(order.orderItems.map((item) => item.creatorId)),
        ],
        items: order.orderItems.map((item) => ({
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          variantOptions: item.variant?.options as
            | { name: string; value: string }[]
            | undefined,
        })),
        shippingAddress: order.shippingAddress || '',
      };

      this.eventEmitter.emit(DomainEvents.ORDER_PROCESSING, payload);
      this.logger.log(
        { orderId, creatorCount: payload.creatorIds.length },
        'ORDER_PROCESSING event emitted',
      );
    } catch (err) {
      this.logger.error(
        `Failed to emit ORDER_PROCESSING for order ${orderId}`,
        err,
      );
    }
  }

  private async sendPaymentReceiptEmail(paymentId: string): Promise<void> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          order: {
            select: {
              orderNumber: true,
              shippingAddress: true,
              createdAt: true,
              totalAmount: true,
              discountAmount: true,
              discountCode: true,
              finalAmount: true,
              orderItems: {
                include: {
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      if (!payment || !payment.user || !payment.order) return;

      const items = payment.order.orderItems.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: Number(item.unitPrice),
      }));

      await this.emailService.sendPaymentReceipt(payment.user.email, {
        orderNumber: payment.order.orderNumber,
        customerName:
          `${payment.user.firstName || ''} ${payment.user.lastName || ''}`.trim() ||
          'Valued Customer',
        customerEmail: payment.user.email,
        shippingAddress: payment.order.shippingAddress || '',
        totalAmount: Number(payment.order.totalAmount),
        discountAmount: Number(payment.order.discountAmount),
        discountCode: payment.order.discountCode,
        finalAmount: Number(payment.order.finalAmount),
        currency: payment.currency,
        createdAt: payment.order.createdAt,
        items,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send payment receipt for payment ${paymentId}`,
        err,
      );
    }
  }
}
