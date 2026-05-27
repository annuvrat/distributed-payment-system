import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';

vi.mock('../../src/db/db.ts', () => {
  return {
    prisma: {
      payment: {
        findUnique: vi.fn(),
      },
    },
  };
});

import { idempotencyMiddleware } from '../../src/middlewares/idempotency.middleware.ts';
import { prisma } from '../../src/db/db.ts';

describe('idempotencyMiddleware', () => {
  it('returns existing payment when idempotency key present', async () => {
    const body = { userId: 'u1', amount: 100 };

    const requestHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

    const existing = { id: 'pay_1', requestHash, status: 'PENDING' };

    (prisma.payment.findUnique as any).mockResolvedValue(existing);

    const ctx: any = {
      req: {
        header: (h: string) => 'key-123',
        json: async () => body,
      },
      set: vi.fn(),
      json: (body: any, status: number) => ({ body, status }),
    };

    const res = await idempotencyMiddleware(ctx as any, async () => Promise.resolve());

    expect(res.status).toBe(200);
    expect(res.body.data.paymentId).toBe(existing.id);
  });

  it('returns 400 when header missing', async () => {
    const ctx: any = {
      req: {
        header: (h: string) => null,
        json: async () => ({}),
      },
      json: (body: any, status: number) => ({ body, status }),
    };

    const res = await idempotencyMiddleware(ctx as any, async () => Promise.resolve());

    expect(res.status).toBe(400);
  });
});
