import { Worker, Job } from 'bullmq';
import { PaymentService } from './payment.service.js';
import { redisConnectionOptions } from '../db/redis.ts';
import { prisma } from '../db/db.ts';
import { dlqQueue } from './queue.service.ts';

export const paymentWorker = new Worker(
  process.env.PAYMENT_QUEUE_NAME || 'payments',

  async (job: Job) => {
    const { paymentId } = job.data;

    console.log(`[Worker] Processing payment: ${paymentId}`);

    await PaymentService.processPaymentExecution(
      paymentId,
      `worker-${process.pid}`,
      job.attemptsMade + 1
    );
  },

  {
    connection: redisConnectionOptions,
    concurrency: 5,
  }
);

paymentWorker.on('completed', (job) => {
  console.log(`[Worker] Job completed: ${job.id}`);
});

paymentWorker.on('error', (err) => {
  console.error('[Worker Error]', err);
});

paymentWorker.on('failed', async (job, error) => {
  console.error(`[Worker] Job failed: ${job?.id}`, error.message);

  // FINAL FAILURE AFTER ALL RETRIES
  if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
    console.log(`[Worker] Retries exhausted for payment: ${job.id}`);

    await prisma.payment.update({
      where: {
        id: job.id as string,
      },

      data: {
        status: 'FAILED',
        lockedAt: null,
        lastFailureReason: 'Retries exhausted after repeated gateway timeouts',
      },
    });

    await prisma.paymentAuditLog.create({
      data: {
        paymentId: job.id as string,

        fromStatus: 'RETRY_SCHEDULED',

        toStatus: 'FAILED',

        attemptNumber: job.attemptsMade,

        eventType: 'PAYMENT_FAILED',

        message: 'Payment permanently failed after retry exhaustion.',

        rawPayload: {
          error: error.message,
        },
      },
    });

    // Send to DLQ queue for further inspection / manual handling
    try {
      await dlqQueue.add(
        'dlq-failed',
        {
          originalJob: job.data,
          failedReason: error.message,
          attemptsMade: job.attemptsMade,
        },
        {
          jobId: `${job.id}:dlq`,
        }
      );
      console.log(`[Worker] Job ${job.id} pushed to DLQ`);
    } catch (e) {
      console.error('[Worker] Failed to push job to DLQ', e);
    }
  }
});
