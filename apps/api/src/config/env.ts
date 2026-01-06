type ApiEnv = {
  chainRpcUrl: string;
  mockUsdtAddress: string;
  escrowAddress: string;
  operatorPrivateKey: string;
};

const addressRegex = /^0x[a-fA-F0-9]{40}$/;
const privateKeyRegex = /^(0x)?[a-fA-F0-9]{64}$/;
const zeroAddress = '0x0000000000000000000000000000000000000000';

function normalizePrivateKey(value: string): string {
  return value.startsWith('0x') ? value : `0x${value}`;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === zeroAddress;
}

export function validateApiEnv(): ApiEnv {
  const errors: string[] = [];

  const chainRpcUrl = process.env.CHAIN_RPC_URL ?? '';
  if (!chainRpcUrl) {
    errors.push('CHAIN_RPC_URL is required');
  } else if (!isHttpUrl(chainRpcUrl)) {
    errors.push('CHAIN_RPC_URL must be a valid http/https URL');
  }

  const mockUsdtAddress = process.env.MOCK_USDT_ADDRESS ?? '';
  if (!addressRegex.test(mockUsdtAddress)) {
    errors.push('MOCK_USDT_ADDRESS is invalid');
  } else if (isZeroAddress(mockUsdtAddress)) {
    errors.push('MOCK_USDT_ADDRESS must not be zero address');
  }

  const escrowAddress = process.env.ESCROW_ADDRESS ?? '';
  if (!addressRegex.test(escrowAddress)) {
    errors.push('ESCROW_ADDRESS is invalid');
  } else if (isZeroAddress(escrowAddress)) {
    errors.push('ESCROW_ADDRESS must not be zero address');
  }

  const operatorPrivateKey = process.env.PLATFORM_OPERATOR_PRIVATE_KEY ?? '';
  if (!privateKeyRegex.test(operatorPrivateKey)) {
    errors.push('PLATFORM_OPERATOR_PRIVATE_KEY is invalid');
  }

  if (errors.length > 0) {
    throw new Error(`API env validation failed: ${errors.join('; ')}`);
  }

  return {
    chainRpcUrl,
    mockUsdtAddress,
    escrowAddress,
    operatorPrivateKey: normalizePrivateKey(operatorPrivateKey),
  };
}
