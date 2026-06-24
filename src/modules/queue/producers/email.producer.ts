import { Injectable, Logger } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
import { BullMQService } from 'src/modules/infrastructure/bullmq/bullmq.service';
import { QUEUE_NAMES, QUEUE_JOB_NAMES } from '../constants';
import {
  EmailSendJobData,
  OrderConfirmationEmailData,
  NewOrderForCreatorEmailData,
  WeeklyCreatorSummaryEmailData,
  AbandonedCartEmailData,
  LowStockAlertEmailData,
} from '../jobs/job.types';

@Injectable()
export class EmailProducer {
  private readonly logger = new Logger(EmailProducer.name);

  constructor(private readonly bullMQService: BullMQService) {}

  async sendEmail(data: EmailSendJobData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL_SEND,
      data,
      options,
    );
    this.logger.debug(
      { to: data.to, subject: data.subject },
      'Email job queued',
    );
  }

  async sendOrderConfirmation(
    data: OrderConfirmationEmailData,
    options?: JobsOptions,
  ) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL_ORDER_CONFIRMATION,
      data,
      options,
    );
  }

  async sendNewOrderToCreator(
    data: NewOrderForCreatorEmailData,
    options?: JobsOptions,
  ) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL_NEW_ORDER_CREATOR,
      data,
      options,
    );
  }

  async sendPaymentFailed(data: EmailSendJobData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL_PAYMENT_FAILED,
      data,
      options,
    );
  }

  async sendReferralReward(data: EmailSendJobData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL_REFERRAL_REWARD,
      data,
      options,
    );
  }

  async sendWeeklySummary(
    data: WeeklyCreatorSummaryEmailData,
    options?: JobsOptions,
  ) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL_WEEKLY_CREATOR_SUMMARY,
      data,
      options,
    );
  }

  async sendAbandonedCartReminder(
    data: AbandonedCartEmailData,
    options?: JobsOptions,
  ) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL_ABANDONED_CART_REMINDER,
      data,
      options,
    );
  }

  async sendLowStockAlert(data: LowStockAlertEmailData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.EMAIL,
      QUEUE_JOB_NAMES.EMAIL_LOW_STOCK_ALERT,
      data,
      options,
    );
  }
}
