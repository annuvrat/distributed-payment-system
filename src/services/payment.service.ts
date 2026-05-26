// src/services/payment.service.ts

import { prisma } from '../db/db.ts';
import {
  simulateExternalGateway,
  type GatewayResponse,
} from '../helpers/gateway.ts';
import {
  withCircuitBreaker,
  isCircuitOpen,
} from '../helpers/circuitBreaker.ts';

import {
  PaymentStatus,
  PaymentEventType,
} from '../../generated/prisma/index.js';

export class PaymentService {
  /**
   * Single payment execution attempt.
   *
   * IMPORTANT:
   * - NO retry loops here
   * - NO setTimeout here
   * - NO process.nextTick here
   *
   * BullMQ owns retries now.
   */
  static async processPaymentExecution(
    paymentId: string,
    workerId: string,
    attemptNumber: number
  ): Promise<void> {
    // =========================================
    // 1. Fetch Payment
    // =========================================

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new Error(`PAYMENT_NOT_FOUND: ${paymentId}`);
    }

    // =========================================
    // 2. Prevent Reprocessing Final States
    // =========================================

    if (
      payment.status === PaymentStatus.SUCCESS ||
      payment.status === PaymentStatus.FAILED
    ) {
      console.log(
        `[Worker ${workerId}] Payment already finalized: ${paymentId}`
      );

      return;
    }

    // =========================================
    // 3. Acquire Processing Lock
    // =========================================
    //
    // Atomic lock acquisition:
    // only one worker can lock this payment.
    //

    const lockResult = await prisma.payment.updateMany({
      where: {
        id: paymentId,
        lockedAt: null,
      },

      data: {
        lockedAt: new Date(),
        workerId,
      },
    });

    // Another worker already owns this payment
    if (lockResult.count === 0) {
      console.log(
        `[Worker ${workerId}] Payment already locked: ${paymentId}`
      );

      return;
    }

    try {
      // =========================================
      // 4. Move To PROCESSING
      // =========================================

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },

          data: {
            status: PaymentStatus.PROCESSING,
            retryCount: attemptNumber - 1,
            lastAttemptAt: new Date(),
          },
        }),

        prisma.paymentAuditLog.create({
          data: {
            paymentId,

            fromStatus: payment.status,
            toStatus: PaymentStatus.PROCESSING,

            eventType: PaymentEventType.PROCESSING_STARTED,

            attemptNumber,

            message: `Payment processing attempt ${attemptNumber} started.`,
          },
        }),
      ]);

      // =========================================
      // 5. Call Gateway (protected by circuit breaker)
      // =========================================

      const cbName = 'external_gateway';

      if (await isCircuitOpen(cbName)) {
        // circuit open: schedule a retry without hammering the gateway
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: paymentId },

            data: {
              status: PaymentStatus.RETRY_SCHEDULED,

              lockedAt: null,
              workerId: null,

              nextRetryAt: new Date(Date.now() + 10000),

              lastFailureReason: 'CIRCUIT_OPEN',
            },
          }),

          prisma.paymentAuditLog.create({
            data: {
              paymentId,

              fromStatus: PaymentStatus.PROCESSING,
              toStatus: PaymentStatus.RETRY_SCHEDULED,

              eventType: PaymentEventType.RETRY_SCHEDULED,

              attemptNumber,

              rawPayload: { reason: 'CIRCUIT_OPEN' } as any,

              message: `Circuit open: deferring gateway call.`,
            },
          }),
        ]);

        console.warn(`[Worker ${workerId}] Circuit open; retrying later: ${paymentId}`);

        throw new Error('CIRCUIT_OPEN');
      }

      const response: GatewayResponse = await withCircuitBreaker(
        cbName,
        () => simulateExternalGateway(Number(payment.amount))
      );

      // =========================================
      // 6. SUCCESS CASE
      // =========================================

      if (response.status === 'SUCCESS') {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: paymentId },

            data: {
              status: PaymentStatus.SUCCESS,
              gatewayReferenceId: response.gatewayReferenceId ?? null,

              lockedAt: null,
              workerId: null,

              lastFailureReason: null,
            },
          }),

          prisma.paymentAuditLog.create({
            data: {
              paymentId,

              fromStatus: PaymentStatus.PROCESSING,
              toStatus: PaymentStatus.SUCCESS,

              eventType: PaymentEventType.PAYMENT_SUCCESS,

              attemptNumber,

              rawPayload: response as any,

              message: `Payment succeeded. Gateway reference: ${response.gatewayReferenceId}`,
            },
          }),
        ]);

        console.log(
          `[Worker ${workerId}] Payment SUCCESS: ${paymentId}`
        );

        return;
      }

      // =========================================
      // 7. TERMINAL FAILURE CASE
      // =========================================

      if (response.status === 'FAILED') {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: paymentId },

            data: {
              status: PaymentStatus.FAILED,

              lockedAt: null,
              workerId: null,

              lastFailureReason:
                response.errorReason || 'PAYMENT_FAILED',
            },
          }),

          prisma.paymentAuditLog.create({
            data: {
              paymentId,

              fromStatus: PaymentStatus.PROCESSING,
              toStatus: PaymentStatus.FAILED,

              eventType: PaymentEventType.PAYMENT_FAILED,

              attemptNumber,

              rawPayload: response as any,

              message: `Gateway rejected payment: ${response.errorReason}`,
            },
          }),
        ]);

        console.log(
          `[Worker ${workerId}] Payment FAILED: ${paymentId}`
        );

        return;
      }

      // =========================================
      // 8. RETRYABLE FAILURE
      // =========================================
      //
      // TIMEOUT -> BullMQ retry
      //

      await prisma.$transaction([
        prisma.payment.update({
          where: { id: paymentId },

          data: {
            status: PaymentStatus.RETRY_SCHEDULED,

            lockedAt: null,
            workerId: null,

            nextRetryAt: new Date(Date.now() + 2000),

            lastFailureReason:
              response.errorReason || 'GATEWAY_TIMEOUT',
          },
        }),

        prisma.paymentAuditLog.create({
          data: {
            paymentId,

            fromStatus: PaymentStatus.PROCESSING,
            toStatus: PaymentStatus.RETRY_SCHEDULED,

            eventType: PaymentEventType.RETRY_SCHEDULED,

            attemptNumber,

            rawPayload: response as any,

            message: `Gateway timeout encountered. BullMQ will retry payment.`,
          },
        }),
      ]);

      console.warn(
        `[Worker ${workerId}] Retry scheduled for payment: ${paymentId}`
      );

      // IMPORTANT:
      // Throw error so BullMQ retries automatically
      throw new Error(
        response.errorReason || 'GATEWAY_TIMEOUT'
      );
    } catch (error) {
      // =========================================
      // 9. Handle Unexpected Errors
      // =========================================

      await prisma.payment.update({
        where: { id: paymentId },

        data: {
          lockedAt: null,
          workerId: null,
        },
      });

      throw error;
    }
  }
}