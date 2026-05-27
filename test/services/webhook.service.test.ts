import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/db/db.ts', () => {
  return {
    prisma: {
      webhookEvent: { findUnique: vi.fn(), create: vi.fn() },
      payment: { findUnique: vi.fn(), update: vi.fn() },
      paymentAuditLog: { create: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

import { WebhookService } from '../../src/services/webhook.service.ts';
import { prisma } from '../../src/db/db.ts';

describe('WebhookService.processWebhook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('persists webhook and reconciles payment on success', async () => {
    (prisma.webhookEvent.findUnique as any).mockResolvedValue(null);

    const payment = { id: 'p1', status: 'PROCESSING' };
    (prisma.payment.findUnique as any).mockResolvedValue(payment);

    (prisma.$transaction as any).mockResolvedValue(true);

    const payload = {
      paymentId: 'p1',
      gatewayReferenceId: 'gwy_1',
      status: 'SUCCESS',
      rawPayload: { foo: 'bar' },
    };

    await WebhookService.processWebhook(payload as any);

    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
