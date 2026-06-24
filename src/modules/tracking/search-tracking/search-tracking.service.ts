import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsProducer } from 'src/modules/queue/producers/analytics.producer';

@Injectable()
export class SearchTrackingService {
  private readonly logger = new Logger(SearchTrackingService.name);

  constructor(private readonly analyticsProducer: AnalyticsProducer) {}

  /**
   * Track a search query for analytics.
   */
  async trackSearch(
    query: string,
    resultsCount: number,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    await this.analyticsProducer.trackSearch({
      query,
      resultsCount,
      userId,
      sessionId,
      timestamp: new Date().toISOString(),
    });

    if (resultsCount === 0) {
      this.logger.debug({ query }, 'Zero-result search tracked');
    }
  }
}
