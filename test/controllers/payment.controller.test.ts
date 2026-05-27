import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/db.ts', () => {
  return {
    prisma: {
      payment: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

vi.mock('../../src/services/queue.service.ts', () => ({
  enqueuePaymentJob: vi.fn(),
}));

import { PaymentController } from '../../src/controllers/payment.controller.ts';
import { prisma } from '../../src/db/db.ts';
import { enqueuePaymentJob } from '../../src/services/queue.service.ts';

describe('PaymentController.createPayment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates payment and enqueues job', async () => {
    (prisma.payment.findUnique as any).mockResolvedValue(null);

    const created = {
      id: 'payment_1',
      status: 'PENDING',
      auditLogs: [],
    };

    (prisma.payment.create as any).mockResolvedValue(created);

    const body = { userId: 'u1', amount: 100, currency: 'INR' };

    const ctx: any = {
      req: { json: async () => body },
      get: (k: string) => 'idem-key-1',
      json: (payload: any, status: number) => ({ payload, status }),
    };

    const res = await PaymentController.createPayment(ctx as any);

    expect(res.status).toBe(202);
    expect(enqueuePaymentJob).toHaveBeenCalledWith(created.id);
  });
});
