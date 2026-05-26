import type { Context, Next } from 'hono';
import { redisConnection } from '../db/redis.ts';

const MAX = Number(process.env.RATE_LIMIT_MAX ?? '60');
const WINDOW = Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? '60');

function rlKey(id: string, windowStart: number) {
  return `rl:${id}:${windowStart}`;
}

export async function rateLimitMiddleware(
  c: Context,
  next: Next
) {
  const identifier =
    c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'anon';

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % WINDOW);

  const key = rlKey(identifier, windowStart);
  const current = await redisConnection.incr(key);
  if (current === 1) {
    await redisConnection.expire(key, WINDOW);
  }

  const remaining = Math.max(0, MAX - current);
  c.header('X-RateLimit-Limit', String(MAX));
  c.header('X-RateLimit-Remaining', String(remaining));

  if (current > MAX) {
    c.header('Retry-After', String(WINDOW));
    return c.json({ success: false, message: 'Rate limit exceeded' }, 429);
  }

  await next();
}
