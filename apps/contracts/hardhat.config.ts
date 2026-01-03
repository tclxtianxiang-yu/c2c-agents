import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: process.env.CHAIN_RPC_URL || '',
      accounts: process.env.PLATFORM_OPERATOR_PRIVATE_KEY
        ? [process.env.PLATFORM_OPERATOR_PRIVATE_KEY]
        : [],
    },
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
