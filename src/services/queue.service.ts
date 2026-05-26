import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../db/redis.ts';

const MAX_ATTEMPTS = Number(process.env.MAX_JOB_ATTEMPTS ?? '3');

export const paymentQueue = new Queue(
  process.env.PAYMENT_QUEUE_NAME || 'payments',
  {
    connection: redisConnectionOptions,
    defaultJobOptions: {
      attempts: MAX_ATTEMPTS,

      backoff: {
        type: 'exponential',
        delay: 2000,
      },

      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }
);

export const dlqQueue = new Queue(
  process.env.DLQ_QUEUE_NAME || 'payments_dlq',
  { connection: redisConnectionOptions }
);

/**
 * Adds a payment job to the queue.
 * jobId ensures duplicate jobs for same payment are ignored.
 */
export async function enqueuePaymentJob(paymentId: string) {
  await paymentQueue.add(
    'process-payment',
    { paymentId },
    {
      jobId: paymentId,
    }
  );
}