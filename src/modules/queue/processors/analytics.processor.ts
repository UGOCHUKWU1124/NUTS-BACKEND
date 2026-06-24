import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from 'src/modules/infrastructure/prisma/prisma.service';
import { TrackProductViewData, TrackSearchData } from '../jobs/job.types';

@Injectable()
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async processProductView(job: Job<TrackProductViewData>): Promise<void> {
    const { productId, userId, sessionId, timestamp } = job.data;

    await this.prisma.productView.create({
      data: {
        productId,
        userId: userId ?? null,
        sessionId: sessionId ?? null,
        createdAt: new Date(timestamp),
      },
    });

    this.logger.debug({ productId, userId }, 'Product view recorded');
  }

  async processSearch(job: Job<TrackSearchData>): Promise<void> {
    const { query, resultsCount, userId, sessionId, timestamp } = job.data;

    await this.prisma.searchQuery.create({
      data: {
        query,
        resultsCount,
        userId: userId ?? null,
        sessionId: sessionId ?? null,
        createdAt: new Date(timestamp),
      },
    });

    this.logger.debug({ query, resultsCount }, 'Search tracked');
  }
}
