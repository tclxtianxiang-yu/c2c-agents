import { expect } from 'chai';
import hre from 'hardhat';

import type { MockUSDT } from '../typechain-types/contracts/MockUSDT';

const { ethers } = hre;

describe('MockUSDT', () => {
  const DECIMALS = 6;
  const FAUCET_AMOUNT = ethers.parseUnits('1000', DECIMALS);

  async function deploy() {
    const [owner, user, spender] = await ethers.getSigners();
    const MockUSDT = await ethers.getContractFactory('MockUSDT');
    const token = (await MockUSDT.deploy()) as unknown as MockUSDT;
    return { token, owner, user, spender };
  }

  it('returns 6 decimals', async () => {
    const { token } = await deploy();
    expect(await token.decimals()).to.equal(6n);
  });

  it('allows owner to mint', async () => {
    const { token, owner, user } = await deploy();
    const amount = ethers.parseUnits('12.5', DECIMALS);

    await token.connect(owner).mint(user.address, amount);
    expect(await token.balanceOf(user.address)).to.equal(amount);
  });

  it('reverts mint from non-owner', async () => {
    const { token, user } = await deploy();
    const amount = ethers.parseUnits('1', DECIMALS);

    let reverted = false;
    try {
      await token.connect(user).mint(user.address, amount);
    } catch (error) {
      reverted = true;
      expect(String(error)).to.match(/OwnableUnauthorizedAccount/);
    }

    expect(reverted).to.equal(true);
  });

  it('faucet mints 1000 USDT to caller', async () => {
    const { token, user } = await deploy();

    await token.connect(user).faucet();
    expect(await token.balanceOf(user.address)).to.equal(FAUCET_AMOUNT);
  });

  it('supports transfer/approve/transferFrom', async () => {
    const { token, owner, user, spender } = await deploy();
    const mintAmount = ethers.parseUnits('50', DECIMALS);
    const transferAmount = ethers.parseUnits('20', DECIMALS);
    const allowanceAmount = ethers.parseUnits('10', DECIMALS);

    await token.connect(owner).mint(owner.address, mintAmount);
    await token.connect(owner).transfer(user.address, transferAmount);
    expect(await token.balanceOf(user.address)).to.equal(transferAmount);

    await token.connect(user).approve(spender.address, allowanceAmount);
    await token.connect(spender).transferFrom(user.address, spender.address, allowanceAmount);
    expect(await token.balanceOf(spender.address)).to.equal(allowanceAmount);
  });
});
