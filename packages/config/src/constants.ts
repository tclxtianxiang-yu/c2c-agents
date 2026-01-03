export const PAIRING_TTL_HOURS = Number(process.env.PAIRING_TTL_HOURS || 24);
export const QUEUE_MAX_N = Number(process.env.QUEUE_MAX_N || 10);
export const AUTO_ACCEPT_HOURS = Number(process.env.AUTO_ACCEPT_HOURS || 24);
export const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_FEE_RATE || 0.15);
export const MIN_CONFIRMATIONS = Number(process.env.MIN_CONFIRMATIONS || 1);
export const AUTO_ACCEPT_SCAN_INTERVAL_MINUTES = Number(
  process.env.AUTO_ACCEPT_SCAN_INTERVAL_MINUTES || 5
);
