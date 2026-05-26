// src/controllers/payment.controller.ts

import type { Context } from 'hono';
import crypto from 'crypto';

import { prisma } from '../db/db.ts';

import {
  PaymentEventType,
  PaymentStatus,
} from '../../generated/prisma/index.js';

import { enqueuePaymentJob } from '../services/queue.service.ts';

/**
 * POST /payments
 *
 * Creates a payment request and queues it for async processing.
 */
export class PaymentController {
  static async createPayment(c: Context) {
    try {
      const body = await c.req.json();

      const {
        userId,
        amount,
        currency = 'INR',
        // idempotencyKey,
      } = body;
   const idempotencyKey = c.get(
        'idempotencyKey'
      );
      // =========================================
      // Basic Validation
      // =========================================

      if (!userId || !amount || !idempotencyKey) {
        return c.json(
          {
            success: false,
            message:
              'userId, amount and idempotencyKey are required',
          },
          400
        );
      }

      // =========================================
      // Idempotency Check
      // =========================================

      const existingPayment = await prisma.payment.findUnique({
        where: {
          idempotencyKey,
        },
      });

      if (existingPayment) {
        return c.json(
          {
            success: true,
            message:
              'Payment already exists for this idempotency key',
            data: existingPayment,
          },
          200
        );
      }

      // =========================================
      // Generate Request Hash
      // =========================================

      const requestHash = crypto
        .createHash('sha256')
        .update(`${userId}-${amount}-${currency}`)
        .digest('hex');

      // =========================================
      // Create Payment + Audit Log
      // =========================================

      const payment = await prisma.payment.create({
        data: {
          userId,
          amount,
          currency,

          status: PaymentStatus.PENDING,

          idempotencyKey,
          requestHash,

          auditLogs: {
            create: {
              fromStatus: null,
              toStatus: PaymentStatus.PENDING,

              eventType:
                PaymentEventType.PAYMENT_CREATED,

              message:
                'Payment created and queued for processing.',
            },
          },
        },

        include: {
          auditLogs: true,
        },
      });

      // =========================================
      // Queue Payment Job
      // =========================================

      await enqueuePaymentJob(payment.id);

      console.log(
        `[Controller] Payment queued: ${payment.id}`
      );

      // =========================================
      // Return Accepted Response
      // =========================================

      return c.json(
        {
          success: true,

          message:
            'Payment accepted and queued for processing.',

          data: {
            paymentId: payment.id,
            status: payment.status,
          },
        },

        202
      );
    } catch (error: any) {
      console.error(
        '[Create Payment Controller Error]',
        error
      );

      return c.json(
        {
          success: false,
          message: error.message || 'Internal server error',
        },
        500
      );
    }
  }

  /**
   * GET /payments/:id
   *
   * Poll payment status.
   */
  static async getPaymentById(c: Context) {
    try {
      const paymentId = c.req.param('id');

      const payment = await prisma.payment.findUnique({
        where: {
          id: paymentId as string,
        },

        include: {
          auditLogs: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!payment) {
        return c.json(
          {
            success: false,
            message: 'Payment not found',
          },
          404
        );
      }

      return c.json(
        {
          success: true,
          data: payment,
        },
        200
      );
    } catch (error: any) {
      console.error(
        '[Get Payment Controller Error]',
        error
      );

      return c.json(
        {
          success: false,
          message: error.message || 'Internal server error',
        },
        500
      );
    }
  }
}