import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the redisConnection used by circuitBreaker
vi.mock('../../src/db/redis.ts', () => {
  const store: Record<string, any> = {};

  return {
    redisConnection: {
      ttl: vi.fn(async (key: string) => {
        const v = store[key];
        if (!v) return -2;
        const expiresAt = v.expiresAt as number | undefined;
        if (!expiresAt) return -1;
        const ttl = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
        return ttl;
      }),
      incr: vi.fn(async (key: string) => {
        store[key] = store[key] || { n: 0 };
        store[key].n = (store[key].n || 0) + 1;
        return store[key].n;
      }),
      expire: vi.fn(async (key: string, seconds: number) => {
        store[key] = store[key] || {};
        store[key].expiresAt = Date.now() + seconds * 1000;
        return 1;
      }),
      set: vi.fn(async (key: string, val: string, ex?: string, seconds?: number) => {
        store[key] = { value: val };
        if (ex === 'EX' && seconds) {
          store[key].expiresAt = Date.now() + seconds * 1000;
        }
        return 'OK';
      }),
      del: vi.fn(async (key: string) => {
        delete store[key];
        return 1;
      }),
    },
  };
});

// Import circuitBreaker module after mocking to ensure our mock is used
let recordFailure: any;
let isCircuitOpen: any;
let recordSuccess: any;

async function loadCircuitBreaker() {
  const mod = await import('../../src/helpers/circuitBreaker.ts');
  recordFailure = mod.recordFailure;
  isCircuitOpen = mod.isCircuitOpen;
  recordSuccess = mod.recordSuccess;
}

describe('circuitBreaker (unit)', () => {
  const name = 'test_cb';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('opens circuit after threshold failures and clears on success', async () => {
    // make threshold deterministic: 1 failure triggers open
    await loadCircuitBreaker();
    await recordFailure(name, { failureThreshold: 1, cooldownSeconds: 2 });

    const open = await isCircuitOpen(name);
    expect(open).toBe(true);

    await recordSuccess(name);

    const openAfter = await isCircuitOpen(name);
    expect(openAfter).toBe(false);
  });
});
