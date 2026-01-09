export const DEFAULT_SEPOLIA_RPC_URL = 'https://rpc.sepolia.org';

export const MIN_CONFIRMATIONS = 1;

export const GAS_PRICE_MULTIPLIER = 1.2;

export const MAX_RETRIES = 3;

export const PLATFORM_FEE_RATE = 0.15;

export const GAS_LIMITS = {
  APPROVE: 60_000,
  DEPOSIT: 120_000,
  PAYOUT: 100_000,
  REFUND: 100_000,
} as const;
