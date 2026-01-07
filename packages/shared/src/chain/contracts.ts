import { DEFAULT_SEPOLIA_RPC_URL } from '@c2c-agents/config/constants';
import type { Escrow } from '@c2c-agents/contracts/typechain-types/contracts/Escrow';
import type { MockUSDT } from '@c2c-agents/contracts/typechain-types/contracts/MockUSDT';
import { Escrow__factory } from '@c2c-agents/contracts/typechain-types/factories/contracts/Escrow__factory';
import { MockUSDT__factory } from '@c2c-agents/contracts/typechain-types/factories/contracts/MockUSDT__factory';
import { JsonRpcProvider, type Provider, type Signer } from 'ethers';

import { ValidationError } from '../errors';
import { normalizeAddress } from '../utils';

export interface ProviderOptions {
  rpcUrl?: string;
}

export interface ContractOptions extends ProviderOptions {
  signer?: Signer;
  provider?: Provider;
  mockUsdtAddress?: string;
  escrowAddress?: string;
}

let cachedProvider: JsonRpcProvider | null = null;
let cachedRpcUrl: string | null = null;

export function getProvider(options: ProviderOptions = {}): JsonRpcProvider {
  const rpcUrl = options.rpcUrl ?? DEFAULT_SEPOLIA_RPC_URL;

  if (!cachedProvider || cachedRpcUrl !== rpcUrl) {
    cachedProvider = new JsonRpcProvider(rpcUrl);
    cachedRpcUrl = rpcUrl;
  }

  return cachedProvider;
}

export function getMockUSDTAddress(overrideAddress?: string): string {
  const address = overrideAddress ?? process.env.NEXT_PUBLIC_MOCK_USDT_ADDRESS;

  if (!address) {
    throw new ValidationError(
      'Missing MockUSDT address: 必须显式传入或配置 NEXT_PUBLIC_MOCK_USDT_ADDRESS'
    );
  }

  return normalizeAddress(address);
}

export function getEscrowAddress(overrideAddress?: string): string {
  const address = overrideAddress ?? process.env.NEXT_PUBLIC_ESCROW_ADDRESS;

  if (!address) {
    throw new ValidationError(
      'Missing Escrow address: 必须显式传入或配置 NEXT_PUBLIC_ESCROW_ADDRESS'
    );
  }

  return normalizeAddress(address);
}

export function getMockUSDTContract(options: ContractOptions = {}): MockUSDT {
  const runner = options.signer ?? options.provider ?? getProvider(options);
  const address = getMockUSDTAddress(options.mockUsdtAddress);

  return MockUSDT__factory.connect(address, runner);
}

export function getEscrowContract(options: ContractOptions = {}): Escrow {
  const runner = options.signer ?? options.provider ?? getProvider(options);
  const address = getEscrowAddress(options.escrowAddress);

  return Escrow__factory.connect(address, runner);
}
