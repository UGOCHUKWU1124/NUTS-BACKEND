import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  Queue,
  QueueOptions,
  Worker,
  WorkerOptions,
  Job,
  JobsOptions,
} from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import {
  QueueJobData,
  QueueJobDefinition,
  QueueHealth,
} from 'src/modules/shared/interfaces/queue.interface';

@Injectable()
export class BullMQService implements OnModuleDestroy {
  private readonly logger = new Logger(BullMQService.name);
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Map<string, Worker> = new Map();
  private readonly defaultQueueOptions: QueueOptions;
  private readonly defaultWorkerOptions: WorkerOptions;
  private readonly redisUrl: string;
  private readonly workerConnection: Redis;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    const prefix = this.configService.get<string>('BULLMQ_PREFIX') || '{nuts}';
    this.redisUrl = this.configService.getOrThrow<string>('REDIS_URL');

    this.defaultQueueOptions = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      connection: redis as unknown as any,
      prefix,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // keep failed jobs for 7 days
          count: 5000,
        },
      },
    };

    // BullMQ workers need a dedicated connection with maxRetriesPerRequest: null.
    // Same URL config as the global RedisModule, just with the required worker setting.
    this.workerConnection = new Redis(this.redisUrl, { maxRetriesPerRequest: null });


    this.defaultWorkerOptions = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      connection: this.workerConnection as unknown as any,
      prefix,
      concurrency: 5,
      lockDuration: 30000,
      stalledInterval: 15000,
    };
  }


  createQueue(name: string, options?: Partial<QueueOptions>): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      ...this.defaultQueueOptions,
      ...options,
    });

    this.queues.set(name, queue);
    this.logger.log(`Queue created: ${name}`);
    return queue;
  }

  createWorker<T extends QueueJobData = QueueJobData>(
    queueName: string,
    processor: (job: Job<T>) => Promise<void>,
    options?: Partial<WorkerOptions>,
  ): Worker {
    if (this.workers.has(queueName)) {
      return this.workers.get(queueName)!;
    }

    const worker = new Worker<T>(
      queueName,
      async (job: Job<T>) => {
        const startTime = Date.now();
        try {
          await processor(job);
          const duration = Date.now() - startTime;
          this.logger.debug(
            {
              queueName,
              jobId: job.id,
              jobName: job.name,
              durationMs: duration,
            },
            'Job completed successfully',
          );
        } catch (error) {
          const duration = Date.now() - startTime;
          this.logger.error(
            {
              queueName,
              jobId: job.id,
              jobName: job.name,
              durationMs: duration,
              attempt: job.attemptsMade,
              error: error instanceof Error ? error.message : String(error),
            },
            'Job failed',
          );
          throw error;
        }
      },
      {
        ...this.defaultWorkerOptions,
        ...options,
      },
    );

    worker.on('failed', (job: Job<T> | undefined, error: Error) => {
      if (job) {
        this.logger.warn(
          {
            queueName,
            jobId: job.id,
            jobName: job.name,
            attemptsMade: job.attemptsMade,
            error: error.message,
          },
          `Job moved to dead letter queue after ${job.attemptsMade} attempts`,
        );
      }
    });

    worker.on('completed', (job: Job<T>) => {
      this.logger.debug(
        {
          queueName,
          jobId: job.id,
          jobName: job.name,
        },
        'Job completed',
      );
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Worker created for queue: ${queueName}`);
    return worker;
  }

  async addJob<T extends QueueJobData>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getOrCreateQueue(queueName);
    return queue.add(jobName, data, {
      ...options,
      deduplication: options?.deduplication
        ? {
            id: options.deduplication.id,
            ttl: options.deduplication.ttl ?? 86400, // default 24h dedup TTL
          }
        : undefined,
    }) as Promise<Job<T>>;
  }

  async addBulk<T extends QueueJobData>(
    queueName: string,
    jobs: QueueJobDefinition<T>[],
  ): Promise<Job<T>[]> {
    const queue = this.getOrCreateQueue(queueName);
    return queue.addBulk(
      jobs.map((j) => ({
        name: j.name,
        data: j.data,
        opts: j.options,
      })),
    ) as Promise<Job<T>[]>;
  }

  async getQueueHealth(queueName: string): Promise<QueueHealth> {
    const queue = this.getOrCreateQueue(queueName);
    const [waiting, active, completed, failed, delayed, isPaused] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
      isPaused,
    };
  }

  async getAllQueuesHealth(): Promise<QueueHealth[]> {
    const queueNames = Array.from(this.queues.keys());
    return Promise.all(queueNames.map((name) => this.getQueueHealth(name)));
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
      this.logger.warn(`Queue paused: ${queueName}`);
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
      this.logger.log(`Queue resumed: ${queueName}`);
    }
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down BullMQ workers and queues...');

    const workerClosePromises = Array.from(this.workers.values()).map(
      (worker) => worker.close(),
    );
    await Promise.all(workerClosePromises);

    const queueClosePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close(),
    );
    await Promise.all(queueClosePromises);

    // Disconnect the dedicated worker Redis connection
    await this.workerConnection.quit().catch(() => this.workerConnection.disconnect());

    this.logger.log('BullMQ workers and queues closed');
  }


  private getOrCreateQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      return this.createQueue(name);
    }
    return this.queues.get(name)!;
  }
}
