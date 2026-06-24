import { Injectable, Logger } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
import { BullMQService } from 'src/modules/infrastructure/bullmq/bullmq.service';
import { QUEUE_NAMES, QUEUE_JOB_NAMES } from '../constants';
import { LowStockCheckJobData } from '../jobs/job.types';

@Injectable()
export class InventoryProducer {
  private readonly logger = new Logger(InventoryProducer.name);

  constructor(private readonly bullMQService: BullMQService) {}

  async queueLowStockCheck(data: LowStockCheckJobData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.INVENTORY,
      QUEUE_JOB_NAMES.INVENTORY_LOW_STOCK_CHECK,
      data,
      options,
    );
  }
}
