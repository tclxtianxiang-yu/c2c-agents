import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { config as dotenvConfig } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// ESM 模式下获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载根目录 .env 文件
dotenvConfig({ path: resolve(__dirname, '../../.env') });

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
