import hre from 'hardhat';

const { ethers } = hre;

function resolveEnvAddress(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  if (!ethers.isAddress(value)) {
    throw new Error(`${name} is not a valid address`);
  }
  return value;
}

function resolveOptionalAddress(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  if (!ethers.isAddress(value)) {
    throw new Error(`${name} is not a valid address`);
  }
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const feeReceiver = resolveEnvAddress('PLATFORM_FEE_RECEIVER', deployerAddress);
  const admin = resolveEnvAddress('PLATFORM_ADMIN_ADDRESS', deployerAddress);
  const operator = resolveOptionalAddress('PLATFORM_OPERATOR_ADDRESS');

  if (!operator) {
    throw new Error('PLATFORM_OPERATOR_ADDRESS is required for deployment');
  }

  if (admin.toLowerCase() !== deployerAddress.toLowerCase()) {
    throw new Error('PLATFORM_ADMIN_ADDRESS must match deployer to grant operator');
  }

  const MockUSDT = await ethers.getContractFactory('MockUSDT');
  const token = await MockUSDT.deploy();
  await token.waitForDeployment();

  const Escrow = await ethers.getContractFactory('Escrow');
  const escrow = await Escrow.deploy(await token.getAddress(), feeReceiver, admin);
  await escrow.waitForDeployment();

  const tx = await escrow.grantOperator(operator);
  await tx.wait();

  console.log('MockUSDT deployed to:', await token.getAddress());
  console.log('Escrow deployed to:', await escrow.getAddress());
  console.log('Deployer:', deployerAddress);
  console.log('Admin:', admin);
  console.log('FeeReceiver:', feeReceiver);
  console.log('Operator:', operator);
  console.log('Operator granted: true');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
