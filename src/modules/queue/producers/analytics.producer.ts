import { Injectable, Logger } from '@nestjs/common';
import { JobsOptions } from 'bullmq';
import { BullMQService } from 'src/modules/infrastructure/bullmq/bullmq.service';
import { QUEUE_NAMES, QUEUE_JOB_NAMES } from '../constants';
import { TrackProductViewData, TrackSearchData } from '../jobs/job.types';

@Injectable()
export class AnalyticsProducer {
  private readonly logger = new Logger(AnalyticsProducer.name);

  constructor(private readonly bullMQService: BullMQService) {}

  async trackProductView(data: TrackProductViewData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.ANALYTICS,
      QUEUE_JOB_NAMES.ANALYTICS_TRACK_PRODUCT_VIEW,
      data,
      options,
    );
  }

  async trackSearch(data: TrackSearchData, options?: JobsOptions) {
    await this.bullMQService.addJob(
      QUEUE_NAMES.ANALYTICS,
      QUEUE_JOB_NAMES.ANALYTICS_TRACK_SEARCH,
      data,
      options,
    );
  }
}
