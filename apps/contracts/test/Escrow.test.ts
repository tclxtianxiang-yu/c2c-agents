import { expect } from 'chai';
import hre from 'hardhat';

import type { Escrow } from '../typechain-types/contracts/Escrow';
import type { MockUSDT } from '../typechain-types/contracts/MockUSDT';

const { ethers } = hre;

describe('Escrow', () => {
  const DECIMALS = 6;

  async function deploy() {
    const [admin, operator, creator, provider, feeReceiver, outsider] = await ethers.getSigners();
    const MockUSDT = await ethers.getContractFactory('MockUSDT');
    const token = (await MockUSDT.connect(admin).deploy()) as unknown as MockUSDT;

    const Escrow = await ethers.getContractFactory('Escrow');
    const escrow = (await Escrow.connect(admin).deploy(
      await token.getAddress(),
      feeReceiver.address,
      admin.address,
    )) as unknown as Escrow;

    await escrow.connect(admin).grantOperator(operator.address);

    return {
      admin,
      operator,
      creator,
      provider,
      feeReceiver,
      outsider,
      token,
      escrow,
    };
  }

  async function expectRevert(promise: Promise<unknown>, match?: RegExp) {
    let reverted = false;
    try {
      await promise;
    } catch (error) {
      reverted = true;
      if (match) {
        expect(String(error)).to.match(match);
      }
    }
    expect(reverted).to.equal(true);
  }

  async function fundEscrow(
    token: Awaited<ReturnType<typeof deploy>>['token'],
    creator: Awaited<ReturnType<typeof deploy>>['creator'],
    escrowAddress: string,
    amount: bigint,
  ) {
    await token.mint(creator.address, amount);
    await token.connect(creator).transfer(escrowAddress, amount);
  }

  it('payout transfers net and fee and records settlement', async () => {
    const { escrow, token, operator, creator, provider, feeReceiver } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-payout'));
    const grossAmount = ethers.parseUnits('100', DECIMALS);
    const feeAmount = ethers.parseUnits('15', DECIMALS);
    const netAmount = grossAmount - feeAmount;

    await fundEscrow(token, creator, await escrow.getAddress(), grossAmount);

    await escrow
      .connect(operator)
      .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount);

    expect(await token.balanceOf(provider.address)).to.equal(netAmount);
    expect(await token.balanceOf(feeReceiver.address)).to.equal(feeAmount);
    expect(await escrow.getStatus(orderId)).to.equal(1n);

    const settlement = await escrow.getSettlement(orderId);
    expect(settlement.status).to.equal(1n);
    expect(settlement.creator).to.equal(creator.address);
    expect(settlement.provider).to.equal(provider.address);
    expect(settlement.grossAmount).to.equal(grossAmount);
    expect(settlement.feeAmount).to.equal(feeAmount);
    expect(settlement.netAmount).to.equal(netAmount);
  });

  it('reverts payout when amounts mismatch', async () => {
    const { escrow, token, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-mismatch'));
    const grossAmount = ethers.parseUnits('100', DECIMALS);
    const feeAmount = ethers.parseUnits('10', DECIMALS);
    const netAmount = ethers.parseUnits('80', DECIMALS);

    await fundEscrow(token, creator, await escrow.getAddress(), grossAmount);

    await expectRevert(
      escrow
        .connect(operator)
        .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount),
      /amount mismatch/,
    );
  });

  it('reverts payout with zero addresses', async () => {
    const { escrow, token, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-zero'));
    const grossAmount = ethers.parseUnits('10', DECIMALS);
    const feeAmount = ethers.parseUnits('2', DECIMALS);
    const netAmount = grossAmount - feeAmount;

    await fundEscrow(token, creator, await escrow.getAddress(), grossAmount);

    await expectRevert(
      escrow
        .connect(operator)
        .payout(orderId, ethers.ZeroAddress, provider.address, grossAmount, netAmount, feeAmount),
      /creator is zero/,
    );

    await expectRevert(
      escrow
        .connect(operator)
        .payout(orderId, creator.address, ethers.ZeroAddress, grossAmount, netAmount, feeAmount),
      /provider is zero/,
    );
  });

  it('reverts payout with zero gross amount', async () => {
    const { escrow, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-zero-gross'));

    await expectRevert(
      escrow.connect(operator).payout(orderId, creator.address, provider.address, 0, 0, 0),
      /grossAmount is zero/,
    );
  });

  it('reverts payout when escrow balance is insufficient', async () => {
    const { escrow, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-insufficient'));
    const grossAmount = ethers.parseUnits('10', DECIMALS);
    const feeAmount = ethers.parseUnits('2', DECIMALS);
    const netAmount = grossAmount - feeAmount;

    await expectRevert(
      escrow
        .connect(operator)
        .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount),
    );
  });

  it('reverts payout when already settled', async () => {
    const { escrow, token, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-settled'));
    const grossAmount = ethers.parseUnits('10', DECIMALS);
    const feeAmount = ethers.parseUnits('2', DECIMALS);
    const netAmount = grossAmount - feeAmount;

    await fundEscrow(token, creator, await escrow.getAddress(), grossAmount);

    await escrow
      .connect(operator)
      .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount);

    await expectRevert(
      escrow
        .connect(operator)
        .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount),
      /already settled/,
    );
  });

  it('reverts payout from non-operator', async () => {
    const { escrow, token, creator, provider, outsider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-no-role'));
    const grossAmount = ethers.parseUnits('10', DECIMALS);
    const feeAmount = ethers.parseUnits('2', DECIMALS);
    const netAmount = grossAmount - feeAmount;

    await fundEscrow(token, creator, await escrow.getAddress(), grossAmount);

    await expectRevert(
      escrow
        .connect(outsider)
        .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount),
      /missing operator\/admin role/,
    );
  });

  it('refund transfers to creator and records settlement', async () => {
    const { escrow, token, operator, creator } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-refund'));
    const amount = ethers.parseUnits('25', DECIMALS);

    await fundEscrow(token, creator, await escrow.getAddress(), amount);

    await escrow.connect(operator).refund(orderId, creator.address, amount);

    expect(await token.balanceOf(creator.address)).to.equal(amount);
    expect(await escrow.getStatus(orderId)).to.equal(2n);
  });

  it('reverts refund with zero creator', async () => {
    const { escrow, operator } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-refund-zero'));

    await expectRevert(
      escrow.connect(operator).refund(orderId, ethers.ZeroAddress, 1),
      /creator is zero/,
    );
  });

  it('reverts refund with zero amount', async () => {
    const { escrow, operator, creator } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-refund-zero-amount'));

    await expectRevert(
      escrow.connect(operator).refund(orderId, creator.address, 0),
      /amount is zero/,
    );
  });

  it('reverts refund when already settled', async () => {
    const { escrow, token, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-refund-settled'));
    const grossAmount = ethers.parseUnits('10', DECIMALS);
    const feeAmount = ethers.parseUnits('2', DECIMALS);
    const netAmount = grossAmount - feeAmount;

    await fundEscrow(token, creator, await escrow.getAddress(), grossAmount);

    await escrow
      .connect(operator)
      .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount);

    await expectRevert(
      escrow.connect(operator).refund(orderId, creator.address, grossAmount),
      /already settled/,
    );
  });

  it('enforces idempotency between payout and refund', async () => {
    const { escrow, token, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-idempotent'));
    const grossAmount = ethers.parseUnits('10', DECIMALS);
    const feeAmount = ethers.parseUnits('2', DECIMALS);
    const netAmount = grossAmount - feeAmount;

    await fundEscrow(token, creator, await escrow.getAddress(), grossAmount);
    await escrow
      .connect(operator)
      .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount);

    await expectRevert(
      escrow.connect(operator).refund(orderId, creator.address, grossAmount),
      /already settled/,
    );
  });

  it('reverts payout after refund', async () => {
    const { escrow, token, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-refund-then-payout'));
    const amount = ethers.parseUnits('8', DECIMALS);

    await fundEscrow(token, creator, await escrow.getAddress(), amount);
    await escrow.connect(operator).refund(orderId, creator.address, amount);

    await expectRevert(
      escrow
        .connect(operator)
        .payout(orderId, creator.address, provider.address, amount, amount, 0),
      /already settled/,
    );
  });

  it('requires admin for fee receiver changes', async () => {
    const { escrow, outsider } = await deploy();
    await expectRevert(
      escrow.connect(outsider).setFeeReceiver(outsider.address),
      /AccessControl/,
    );
  });

  it('requires admin for pause and unpause', async () => {
    const { escrow, outsider } = await deploy();
    await expectRevert(escrow.connect(outsider).pause(), /AccessControl/);
    await expectRevert(escrow.connect(outsider).unpause(), /AccessControl/);
  });

  it('reverts invalid admin parameter updates', async () => {
    const { escrow, admin } = await deploy();

    await expectRevert(
      escrow.connect(admin).setFeeReceiver(ethers.ZeroAddress),
      /feeReceiver is zero/,
    );
    await expectRevert(escrow.connect(admin).grantOperator(ethers.ZeroAddress), /operator is zero/);
    await expectRevert(escrow.connect(admin).sweep(ethers.ZeroAddress, 1), /sweep to zero/);
    await expectRevert(escrow.connect(admin).sweep(admin.address, 0), /sweep amount is zero/);
  });

  it('blocks payout/refund when paused and allows after unpause', async () => {
    const { escrow, token, admin, operator, creator, provider } = await deploy();
    const orderId = ethers.keccak256(ethers.toUtf8Bytes('order-paused'));
    const grossAmount = ethers.parseUnits('10', DECIMALS);
    const feeAmount = ethers.parseUnits('1', DECIMALS);
    const netAmount = grossAmount - feeAmount;

    await fundEscrow(token, creator, await escrow.getAddress(), grossAmount);
    await escrow.connect(admin).pause();

    await expectRevert(
      escrow
        .connect(operator)
        .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount),
    );

    await escrow.connect(admin).unpause();

    await escrow
      .connect(operator)
      .payout(orderId, creator.address, provider.address, grossAmount, netAmount, feeAmount);
  });

  it('allows admin to sweep tokens', async () => {
    const { escrow, token, admin, creator } = await deploy();
    const amount = ethers.parseUnits('5', DECIMALS);

    await fundEscrow(token, creator, await escrow.getAddress(), amount);
    await escrow.connect(admin).sweep(admin.address, amount);

    expect(await token.balanceOf(admin.address)).to.equal(amount);
  });
});
