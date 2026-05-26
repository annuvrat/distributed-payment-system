import { Hono } from 'hono';

import { WebhookController } from '../controllers/webhook.controller.ts';

const webhookRoutes = new Hono();

webhookRoutes.post(
  '/payment',
  WebhookController.handlePaymentWebhook
);

export default webhookRoutes;