import type { Context } from 'hono';

import { WebhookService } from '../services/webhook.service.ts';

export class WebhookController {
  /**
   * POST /webhooks/payment
   */
  static async handlePaymentWebhook(c: Context) {
    try {
      const body = await c.req.json();

      await WebhookService.processWebhook(body);

      // IMPORTANT:
      // Always ACK webhook quickly.
      return c.json(
        {
          success: true,
          message: 'Webhook received',
        },
        200
      );
    } catch (error: any) {
      console.error(
        '[Webhook Controller Error]',
        error
      );

      // Still return 200 in many real systems
      // to avoid aggressive webhook retries.
      return c.json(
        {
          success: false,
          message:
            error.message || 'Webhook processing failed',
        },
        200
      );
    }
  }
}