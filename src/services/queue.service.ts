import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../db/redis.ts';

export const paymentQueue = new Queue(
  process.env.PAYMENT_QUEUE_NAME || 'payments',
  {
    connection: redisConnectionOptions,
    defaultJobOptions: {
      attempts: 3,

      backoff: {
        type: 'exponential',
        delay: 2000,
      },

      removeOnComplete: 100,
      removeOnFail: 500,
    },
  }
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