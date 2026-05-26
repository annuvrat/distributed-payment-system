import { redisConnection } from '../db/redis.ts';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // failures before opening
  windowSeconds?: number; // sliding window for counting failures
  cooldownSeconds?: number; // how long circuit stays open
}

const DEFAULTS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  windowSeconds: 60,
  cooldownSeconds: 30,
};

function failureKey(name: string) {
  return `cb:failures:${name}`;
}

function openKey(name: string) {
  return `cb:open:${name}`;
}

export async function isCircuitOpen(name: string) {
  const key = openKey(name);
  const ttl = await redisConnection.ttl(key);
  return ttl > 0;
}

export async function recordSuccess(name: string) {
  // on success we clear failures and open state
  await Promise.all([
    redisConnection.del(failureKey(name)),
    redisConnection.del(openKey(name)),
  ]);
}

export async function recordFailure(name: string, opts?: CircuitBreakerOptions) {
  const o = { ...DEFAULTS, ...(opts || {}) } as Required<CircuitBreakerOptions>;

  const fk = failureKey(name);
  const failures = await redisConnection.incr(fk);
  if (failures === 1) {
    // set expiry for the sliding window
    await redisConnection.expire(fk, o.windowSeconds);
  }

  if (failures >= o.failureThreshold) {
    // open circuit
    await redisConnection.set(openKey(name), '1', 'EX', o.cooldownSeconds);
  }
}

export async function withCircuitBreaker<T>(
  name: string,
  fn: () => Promise<T>,
  opts?: CircuitBreakerOptions
) {
  if (await isCircuitOpen(name)) {
    throw new Error('CIRCUIT_OPEN');
  }

  try {
    const res = await fn();
    await recordSuccess(name);
    return res;
  } catch (err) {
    await recordFailure(name, opts);
    throw err;
  }
}
