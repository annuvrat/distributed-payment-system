import { describe, it, expect } from 'vitest';
import { simulateExternalGateway } from '../../src/helpers/gateway.ts';

describe('simulateExternalGateway', () => {
  it('returns one of the expected statuses', async () => {
    // run multiple times to exercise randomness
    const results = new Set<string>();

    for (let i = 0; i < 20; i++) {
      // keep amount small to exercise function
      // but function behaviour is independent of amount
      // each call waits a small random latency
      // allow tests a reasonable timeout
      // eslint-disable-next-line no-await-in-loop
      const res = await simulateExternalGateway(100);
      results.add(res.status);
      expect(['SUCCESS', 'FAILED', 'TIMEOUT']).toContain(res.status);
      if (res.status === 'SUCCESS') {
        expect(res.gatewayReferenceId).toBeDefined();
      }
      if (res.status === 'FAILED' || res.status === 'TIMEOUT') {
        expect(res.errorReason).toBeDefined();
      }
    }

    // ensure at least two distinct outcomes observed in 20 runs
    expect(results.size).toBeGreaterThanOrEqual(2);
  }, 20000);
});
