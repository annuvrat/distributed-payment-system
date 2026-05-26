import { Hono } from "hono";
import { serve } from '@hono/node-server';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

import { secureHeaders } from 'hono/secure-headers';
import { errorHandler } from "./src/middlewares/error.middleware.ts";
import { configDotenv } from "dotenv";
import { prisma } from "./src/db/db.ts";
import paymentRoutes from './src/routes/payment.route.ts';
import webhookRoutes from './src/routes/webhook.routes.ts';
configDotenv();
const app = new Hono();

app.use(logger());
app.use(cors());
app.use(secureHeaders());
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'],
  credentials: true,
}));

app.get("/", (c) => c.text("Hello, World!"));

app.route('/payments', paymentRoutes);
app.route('/webhooks', webhookRoutes);
app.get('/user', async (c) => {
  const user = await prisma.user.findFirst(
    {where: { email: c.req.query('email')as string }}
  );
  return c.json(user);
});

app.onError(errorHandler);
 

serve(app,()=>{
    console.log('Server is running on http://localhost:3000');
})