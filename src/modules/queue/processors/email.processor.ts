import { Injectable, Logger, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import type { EmailProvider } from 'src/modules/shared/interfaces/email-provider.interface';
import {
  EmailSendJobData,
  OrderConfirmationEmailData,
  NewOrderForCreatorEmailData,
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
}
