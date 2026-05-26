// src/helpers/gateway.ts

export interface GatewayResponse {
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  gatewayReferenceId?: string;
  errorReason?: string;
}

/**
 * Simulates an external payment gateway with realistic random outcomes.
 * Fulfills requirement: External Gateway Simulation
 */
export async function simulateExternalGateway(amount: number): Promise<GatewayResponse> {
  // 1. Simulate network latency (between 400ms and 1200ms)
  const latency = Math.floor(Math.random() * 800) + 400;
  await new Promise((resolve) => setTimeout(resolve, latency));

  const roll = Math.random();

  // 60% Chance of straight success
  if (roll < 0.60) {
    return {
      status: 'SUCCESS',
      gatewayReferenceId: `gwy_tx_${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
    };
  }
  
  // 20% Chance of an explicit business failure (Do NOT retry these)
  if (roll < 0.80) {
    return {
      status: 'FAILED',
      errorReason: 'INSUFFICIENT_FUNDS',
    };
  }

  // 20% Chance of a network drop / timeout (DO retry these)
  return {
    status: 'TIMEOUT',
    errorReason: 'GATEWAY_ENDPOINT_TIMEOUT',
  };
}