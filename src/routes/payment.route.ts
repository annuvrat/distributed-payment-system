import { Hono } from 'hono';

import { PaymentController } from '../controllers/payment.controller.ts';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware.ts';
const paymentRoutes = new Hono();

paymentRoutes.post( '/', idempotencyMiddleware, PaymentController.createPayment);

paymentRoutes.get(  '/:id', PaymentController.getPaymentById);

export default paymentRoutes;