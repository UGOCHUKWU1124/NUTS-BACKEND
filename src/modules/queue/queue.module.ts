import { Module, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { BullMQService } from 'src/modules/infrastructure/bullmq/bullmq.service';
import { QUEUE_NAMES } from './constants';
import { EmailProducer } from './producers/email.producer';
import { AnalyticsProducer } from './producers/analytics.producer';
import { CartProducer } from './producers/cart.producer';
import { InventoryProducer } from './producers/inventory.producer';
import { EmailProcessor } from './processors/email.processor';
import { AnalyticsProcessor } from './processors/analytics.processor';
import { CartProcessor } from './processors/cart.processor';
import { InventoryProcessor } from './processors/inventory.processor';
import { EmailTemplatesService } from 'src/modules/notification/templates/email-templates.service';
import { QUEUE_JOB_NAMES } from './constants/queue-names.constant';

// BullMQ workers receive Job<unknown> from the queue framework; each processor
// narrows the type internally, so the generic cast here is intentional.
/* eslint-disable @typescript-eslint/no-unsafe-argument */

@Module({
  providers: [
    // Producers
    EmailProducer,
    AnalyticsProducer,
    CartProducer,
    InventoryProducer,

    // Processors
    EmailProcessor,
    AnalyticsProcessor,
    CartProcessor,
    InventoryProcessor,

    // Dependencies
    EmailTemplatesService,
  ],
  exports: [
    EmailProducer,
    AnalyticsProducer,
    CartProducer,
    InventoryProducer,
    EmailProcessor,
    AnalyticsProcessor,
    CartProcessor,
    InventoryProcessor,
  ],
})
export class QueueModule implements OnModuleInit {
  constructor(
    private readonly bullMQService: BullMQService,
    private readonly emailProcessor: EmailProcessor,
    private readonly analyticsProcessor: AnalyticsProcessor,
    private readonly cartProcessor: CartProcessor,
    private readonly inventoryProcessor: InventoryProcessor,
  ) {}

  onModuleInit() {
    // Create queues
    this.bullMQService.createQueue(QUEUE_NAMES.EMAIL);
    this.bullMQService.createQueue(QUEUE_NAMES.ANALYTICS);
    this.bullMQService.createQueue(QUEUE_NAMES.CART);
    this.bullMQService.createQueue(QUEUE_NAMES.INVENTORY);

    // Register workers with processors
    this.bullMQService.createWorker(QUEUE_NAMES.EMAIL, async (job: Job) => {
      switch (job.name) {
        case QUEUE_JOB_NAMES.EMAIL_SEND:
          await this.emailProcessor.processSend(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_ORDER_CONFIRMATION:
          await this.emailProcessor.processOrderConfirmation(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_NEW_ORDER_CREATOR:
          await this.emailProcessor.processNewOrderForCreator(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_WEEKLY_CREATOR_SUMMARY:
          await this.emailProcessor.processWeeklySummary(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_ABANDONED_CART_REMINDER:
          await this.emailProcessor.processAbandonedCart(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_LOW_STOCK_ALERT:
          await this.emailProcessor.processLowStockAlert(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_ORDER_SHIPPED:
          await this.emailProcessor.processOrderShipped(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_ORDER_DELIVERED:
          await this.emailProcessor.processOrderDelivered(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_ORDER_CANCELLED:
          await this.emailProcessor.processOrderCancelled(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_PAYMENT_CONFIRMED:
          await this.emailProcessor.processPaymentConfirmed(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_PAYMENT_FAILED:
          await this.emailProcessor.processPaymentFailed(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_REFERRAL_REWARD:
          await this.emailProcessor.processReferralReward(job as any);
          break;
        case QUEUE_JOB_NAMES.EMAIL_CREATOR_PAYMENT_CONFIRMED:
          await this.emailProcessor.processCreatorPaymentConfirmed(job as any);
          break;
        default:
          await this.emailProcessor.processSend(job as any);
      }
    });

    this.bullMQService.createWorker(QUEUE_NAMES.ANALYTICS, async (job: Job) => {
      switch (job.name) {
        case QUEUE_JOB_NAMES.ANALYTICS_TRACK_PRODUCT_VIEW:
          await this.analyticsProcessor.processProductView(job as any);
          break;
        case QUEUE_JOB_NAMES.ANALYTICS_TRACK_SEARCH:
          await this.analyticsProcessor.processSearch(job as any);
          break;
      }
    });

    this.bullMQService.createWorker(QUEUE_NAMES.CART, async (job: Job) => {
      switch (job.name) {
        case QUEUE_JOB_NAMES.CART_ABANDONED_FIRST_REMINDER:
          await this.cartProcessor.processFirstReminder(job as any);
          break;
        case QUEUE_JOB_NAMES.CART_ABANDONED_SECOND_REMINDER:
          await this.cartProcessor.processSecondReminder(job as any);
          break;
      }
    });

    this.bullMQService.createWorker(QUEUE_NAMES.INVENTORY, async (job: Job) => {
      switch (job.name) {
        case QUEUE_JOB_NAMES.INVENTORY_LOW_STOCK_CHECK:
          await this.inventoryProcessor.processLowStockCheck(job as any);
          break;
      }
    });
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-argument */
