import { Job, JobsOptions, QueueOptions, WorkerOptions } from 'bullmq';

export interface QueueJobData {
  [key: string]: unknown;
}

export interface QueueJobDefinition<T extends QueueJobData = QueueJobData> {
  name: string;
  data: T;
  options?: JobsOptions;
}

export interface QueueProvider {
  add<T extends QueueJobData>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>>;

  addBulk<T extends QueueJobData>(
    queueName: string,
    jobs: QueueJobDefinition<T>[],
  ): Promise<Job<T>[]>;

  getQueueOptions(): QueueOptions;
  getWorkerOptions(): WorkerOptions;

  getQueueName(): string;
}

export interface QueueHealth {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
}
