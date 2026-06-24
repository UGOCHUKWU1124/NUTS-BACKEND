import { Injectable, Logger } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
import { BullMQService } from 'src/modules/infrastructure/bullmq/bullmq.service';
import { QUEUE_NAMES, QUEUE_JOB_NAMES } from '../constants';
import { CartReminderJobData } from '../jobs/job.types';

@Injectable()
export class CartProducer {
  private readonly logger = new Logger(CartProducer.name);

  constructor(private readonly bullMQService: BullMQService) {}

  async queueFirstReminder(data: CartReminderJobData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.CART,
      QUEUE_JOB_NAMES.CART_ABANDONED_FIRST_REMINDER,
      data,
      options,
    );
  }

  async queueSecondReminder(data: CartReminderJobData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.CART,
      QUEUE_JOB_NAMES.CART_ABANDONED_SECOND_REMINDER,
      data,
      options,
    );
  }
}
