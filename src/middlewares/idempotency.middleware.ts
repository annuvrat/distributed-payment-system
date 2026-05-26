import type { Context, Next } from 'hono';

import crypto from 'crypto';

import { prisma } from '../db/db.ts';

export async function idempotencyMiddleware(
  c: Context,
  next: Next
) {
  try {
    const idempotencyKey =
      c.req.header('Idempotency-Key');

    if (!idempotencyKey) {
      return c.json(
        {
          success: false,
          message:
            'Idempotency-Key header is required',
        },
        400
      );
    }

    const body = await c.req.json();

    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');

    const existingPayment =
      await prisma.payment.findUnique({
        where: {
          idempotencyKey,
        },
      });

    if (existingPayment) {
      if (
        existingPayment.requestHash !== requestHash
      ) {
        return c.json(
          {
            success: false,
            message:
              'Idempotency key already used with different payload',
          },
          409
        );
      }

      return c.json(
        {
          success: true,
          message:
            'Returning existing payment response',
          data: {
            paymentId: existingPayment.id,
            status: existingPayment.status,
          },
        },
        200
      );
    }

    c.set('idempotencyKey', idempotencyKey);
    c.set('requestHash', requestHash);
    c.set('validatedBody', body);
await next();
  } catch (error: any) {
    console.error(
      '[Idempotency Middleware Error]',
      error
    );

    return c.json(
      {
        success: false,
        message: 'Invalid request payload',
      },
      400
    );
  }
}