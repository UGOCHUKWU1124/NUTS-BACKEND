import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { AnalyticsProducer } from 'src/modules/queue/producers/analytics.producer';
import { TRACKING } from 'src/modules/shared/constants';
import { v4 as uuidv4 } from 'uuid';

interface BufferedView {
  productId: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
}

@Injectable()
export class ProductViewsService {
  private readonly logger = new Logger(ProductViewsService.name);
  private readonly viewBufferKey = 'tracking:product_views:buffer';
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly analyticsProducer: AnalyticsProducer,
  ) {
    this.startFlushTimer();
  }

  /**
   * Track a product view — buffers in Redis, flushes to queue periodically.
   */
  async trackView(
    productId: string,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    const view: BufferedView = {
      productId,
      userId,
      sessionId: sessionId || uuidv4(),
      timestamp: new Date().toISOString(),
    };

    await this.redis.rpush(this.viewBufferKey, JSON.stringify(view));
  }

  /**
   * Flush buffered views to the analytics queue for DB insertion.
   */
  async flushViews(): Promise<void> {
    const batchSize = TRACKING.PRODUCT_VIEW_BATCH_SIZE;
    let processed = 0;

    while (true) {
      const raw = await this.redis.lpop(this.viewBufferKey, batchSize);
      if (!raw || raw.length === 0) break;

      const views: BufferedView[] = raw
        .map((item) => {
          try {
            return JSON.parse(item) as BufferedView;
          } catch {
            return null;
          }
        })
        .filter((v): v is BufferedView => v !== null);

      if (views.length > 0) {
        for (const view of views) {
          await this.analyticsProducer.trackProductView({
            productId: view.productId,
            userId: view.userId,
            sessionId: view.sessionId,
            timestamp: view.timestamp,
          });
        }
        processed += views.length;
      }
    }

    if (processed > 0) {
      this.logger.debug({ count: processed }, 'Flushed product views to queue');
    }
  }

  private startFlushTimer(): void {
    const interval = TRACKING.PRODUCT_VIEW_FLUSH_INTERVAL_MS;
    this.flushTimer = setInterval(() => {
      void this.flushViews().catch((err) => {
        this.logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Failed to flush product views',
        );
      });
    }, interval);

    // Prevent timer from keeping process alive
    if (this.flushTimer && typeof this.flushTimer === 'object') {
      this.flushTimer.unref();
    }
  }

  /**
   * Call on module destroy to flush remaining views.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushViews();
  }
}
