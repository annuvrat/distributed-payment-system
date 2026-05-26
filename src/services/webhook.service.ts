// src/services/webhook.service.ts

import { prisma } from '../db/db.ts';

import {
  PaymentEventType,
  PaymentStatus,
} from '../../generated/prisma/index.js';

interface WebhookPayload {
  paymentId: string;

  gatewayReferenceId: string;

  status: 'SUCCESS' | 'FAILED';

  rawPayload?: any;
}

export class WebhookService {
  /**
   * Handles asynchronous gateway reconciliation callbacks.
   */
  static async processWebhook(
    payload: WebhookPayload
  ): Promise<void> {
    const {
      paymentId,
      gatewayReferenceId,
      status,
      rawPayload,
    } = payload;

    // =========================================
    // STEP 1 — Deduplication Check
    // =========================================

    const existingWebhook =
      await prisma.webhookEvent.findUnique({
        where: {
          gatewayReferenceId,
        },
      });

    if (existingWebhook) {
      console.log(
        `[Webhook] Duplicate ignored: ${gatewayReferenceId}`
      );

      await prisma.paymentAuditLog.create({
        data: {
          paymentId,

          fromStatus: null,

          toStatus: PaymentStatus.FAILED,

          eventType:
            PaymentEventType.WEBHOOK_DUPLICATE_IGNORED,

          message: `Duplicate webhook ignored for gateway reference ${gatewayReferenceId}`,

          rawPayload: rawPayload || {},
        },
      });

      return;
    }

    // =========================================
    // STEP 2 — Fetch Payment
    // =========================================

    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
    });

    if (!payment) {
      throw new Error(
        `Payment not found: ${paymentId}`
      );
    }

    // =========================================
    // STEP 3 — Final State Protection
    // =========================================

    // SUCCESS is terminal — never downgrade
    if (
      payment.status === PaymentStatus.SUCCESS &&
      status === 'FAILED'
    ) {
      console.log(
        `[Webhook] Conflict ignored. SUCCESS cannot downgrade to FAILED`
      );

      await prisma.paymentAuditLog.create({
        data: {
          paymentId,

          fromStatus: payment.status,

          toStatus: payment.status,

          eventType:
            PaymentEventType.WEBHOOK_CONFLICT_IGNORED,

          message:
            'Ignored FAILED webhook because payment already SUCCESS.',

          rawPayload: rawPayload || {},
        },
      });

      return;
    }

    // =========================================
    // STEP 4 — Determine Next State
    // =========================================

    const nextStatus =
      status === 'SUCCESS'
        ? PaymentStatus.SUCCESS
        : PaymentStatus.FAILED;

    // =========================================
    // STEP 5 — Atomic Reconciliation
    // =========================================

    await prisma.$transaction([
      // Persist webhook ledger
      prisma.webhookEvent.create({
        data: {
          paymentId,

          gatewayReferenceId,

          webhookStatus: status,

          payload: rawPayload || {},
        },
      }),

      // Update payment state
      prisma.payment.update({
        where: {
          id: paymentId,
        },

        data: {
          status: nextStatus,

          gatewayReferenceId,

          lockedAt: null,
        },
      }),

      // Create audit trail
      prisma.paymentAuditLog.create({
        data: {
          paymentId,

          fromStatus: payment.status,

          toStatus: nextStatus,

          eventType:
            status === 'SUCCESS'
              ? PaymentEventType.WEBHOOK_SUCCESS
              : PaymentEventType.WEBHOOK_FAILED,

          message: `Webhook reconciled payment to ${nextStatus}`,

          rawPayload: rawPayload || {},
        },
      }),
    ]);

    console.log(
      `[Webhook] Payment reconciled: ${paymentId} -> ${nextStatus}`
    );
  }
}