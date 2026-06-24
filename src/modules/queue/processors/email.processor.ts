import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import type { EmailProvider } from 'src/modules/shared/interfaces/email-provider.interface';
import {
  EmailSendJobData,
  OrderConfirmationEmailData,
  NewOrderForCreatorEmailData,
  OrderShippedEmailData,
  OrderDeliveredEmailData,
  OrderCancelledEmailData,
  PaymentConfirmedEmailData,
  PaymentFailedEmailData,
  ReferralRewardEmailData,
  CreatorPaymentConfirmedEmailData,
  WeeklyCreatorSummaryEmailData,
  AbandonedCartEmailData,
  LowStockAlertEmailData,
} from '../jobs/job.types';
import { EmailTemplatesService } from 'src/modules/notification/templates/email-templates.service';

@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    @Inject('EMAIL_PROVIDER') private readonly emailProvider: EmailProvider,
    private readonly emailTemplates: EmailTemplatesService,
  ) {}

  async processSend(job: Job<EmailSendJobData>): Promise<void> {
    const { to, subject, html, text, attachments, cc, bcc, replyTo } = job.data;
    await this.emailProvider.send({
      to,
      subject,
      html,
      text,
      attachments,
      cc,
      bcc,
      replyTo,
    });
    this.logger.debug({ to, subject }, 'Email sent via queue');
  }

  async processOrderConfirmation(
    job: Job<OrderConfirmationEmailData>,
  ): Promise<void> {
    const html = this.emailTemplates.orderConfirmation(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `Order Confirmation - ${job.data.orderNumber}`,
      html,
    });
  }

  async processNewOrderForCreator(
    job: Job<NewOrderForCreatorEmailData>,
  ): Promise<void> {
    const html = this.emailTemplates.newOrderForCreator(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `New Order Received - ${job.data.orderNumber}`,
      html,
    });
  }

  async processWeeklySummary(
    job: Job<WeeklyCreatorSummaryEmailData>,
  ): Promise<void> {
    const html = this.emailTemplates.weeklyCreatorSummary(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: 'Your Weekly Earnings Summary - NUTS',
      html,
    });
  }

  async processAbandonedCart(job: Job<AbandonedCartEmailData>): Promise<void> {
    const html = this.emailTemplates.abandonedCartReminder(job.data);
    const subject =
      job.data.reminderType === 'first'
        ? 'You left something in your cart!'
        : 'Your cart is about to expire!';
    await this.emailProvider.send({
      to: job.data.to,
      subject,
      html,
    });
  }

  async processLowStockAlert(job: Job<LowStockAlertEmailData>): Promise<void> {
    const html = this.emailTemplates.lowStockAlert(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `Low Stock Alert - ${job.data.productName}`,
      html,
    });
  }

  async processOrderShipped(job: Job<OrderShippedEmailData>): Promise<void> {
    const html = this.emailTemplates.orderShipped(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `Your Order #${job.data.orderNumber} Has Shipped!`,
      html,
    });
  }

  async processOrderDelivered(
    job: Job<OrderDeliveredEmailData>,
  ): Promise<void> {
    const html = this.emailTemplates.orderDelivered(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `Order Delivered - ${job.data.orderNumber}`,
      html,
    });
  }

  async processOrderCancelled(
    job: Job<OrderCancelledEmailData>,
  ): Promise<void> {
    const html = this.emailTemplates.orderCancelled(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `Order #${job.data.orderNumber} Cancelled`,
      html,
    });
  }

  async processPaymentConfirmed(
    job: Job<PaymentConfirmedEmailData>,
  ): Promise<void> {
    const html = this.emailTemplates.paymentConfirmed(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `Payment Confirmed - Order #${job.data.orderNumber}`,
      html,
    });
  }

  async processPaymentFailed(job: Job<PaymentFailedEmailData>): Promise<void> {
    const html = this.emailTemplates.paymentFailed(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `Payment Failed - Order #${job.data.orderNumber}`,
      html,
    });
  }

  async processReferralReward(
    job: Job<ReferralRewardEmailData>,
  ): Promise<void> {
    const html = this.emailTemplates.referralRewardCredited(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: 'You Earned a Referral Reward!',
      html,
    });
  }

  async processCreatorPaymentConfirmed(
    job: Job<CreatorPaymentConfirmedEmailData>,
  ): Promise<void> {
    const html = this.emailTemplates.creatorPaymentConfirmed(job.data);
    await this.emailProvider.send({
      to: job.data.to,
      subject: `Earnings Credited - Order #${job.data.orderNumber}`,
      html,
    });
  }
}
