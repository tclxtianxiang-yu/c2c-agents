'use client';

import { getMockUSDTAddress, getMockUSDTContract } from '@c2c-agents/shared/chain';
import { fromMinUnit } from '@c2c-agents/shared/utils';
import { BrowserProvider } from 'ethers';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { TopNav } from '../../components/layout/TopNav';

const USDT_DECIMALS = 6;
const FAUCET_AMOUNT = '1000';

type WalletState = {
  balance: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
  txHash?: string;
};

function formatWholeAmount(minUnitAmount: string): string {
  const full = fromMinUnit(minUnitAmount, USDT_DECIMALS);
  return full.split('.')[0] ?? full;
}

export default function WalletPage() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [walletState, setWalletState] = useState<WalletState>({
    balance: '0',
    status: 'idle',
  });
  const [isMinting, setIsMinting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const mockUsdtAddress = useMemo(() => {
    try {
      return getMockUSDTAddress();
    } catch {
      return '';
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!address) return;

    const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setWalletState((prev) => ({
        ...prev,
        status: 'error',
        message: '未检测到钱包插件',
      }));
      return;
    }

    setWalletState((prev) => ({ ...prev, status: 'loading' }));
    try {
      const provider = new BrowserProvider(ethereum as never);
      const contract = getMockUSDTContract({ provider });
      const balance = await contract.balanceOf(address);
      setWalletState({
        balance: formatWholeAmount(balance.toString()),
        status: 'success',
      });
    } catch (error) {
      setWalletState((prev) => ({
        ...prev,
        status: 'error',
        message: error instanceof Error ? error.message : '读取余额失败',
      }));
    }
  }, [address]);

  useEffect(() => {
    if (!isConnected || !address) {
      setWalletState({ balance: '0', status: 'idle' });
      return;
    }
    fetchBalance();
  }, [address, fetchBalance, isConnected]);

  const handleFaucet = async () => {
    if (!address) return;
    const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setWalletState((prev) => ({
        ...prev,
        status: 'error',
        message: '未检测到钱包插件',
      }));
      return;
    }

    setIsMinting(true);
    setWalletState((prev) => ({
      ...prev,
      status: 'loading',
      message: '等待钱包确认领取...',
      txHash: undefined,
    }));

    try {
      const provider = new BrowserProvider(ethereum as never);
      const signer = await provider.getSigner();
      const contract = getMockUSDTContract({ signer });
      const tx = await contract.faucet();
      setWalletState((prev) => ({
        ...prev,
        message: '交易已提交，等待上链确认...',
        txHash: tx.hash,
      }));
      const receipt = await tx.wait(1);
      if (!receipt || receipt.status !== 1) {
        throw new Error('交易失败，请在钱包或区块浏览器确认');
      }
      await fetchBalance();
      setWalletState((prev) => ({
        ...prev,
        status: 'success',
        message: `已领取 ${FAUCET_AMOUNT} USDT`,
      }));
    } catch (error) {
      setWalletState((prev) => ({
        ...prev,
        status: 'error',
        message: error instanceof Error ? error.message : '领取失败',
      }));
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(24,36,70,0.6),rgba(10,14,30,0.95))] text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12">
        <section className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-[0_35px_80px_rgba(8,12,28,0.55)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Faucet / MockUSDT
              </p>
              <h1 className="mt-3 text-3xl font-semibold">领取测试 USDT 余额</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                在 Sepolia 环境领取测试币，用于支付任务的 escrow 预付款。
              </p>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm">
              <p className="text-muted-foreground">当前钱包余额</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{walletState.balance} USDT</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-border/70 bg-card/60 p-8 backdrop-blur">
            <h2 className="text-xl font-semibold">一键领取</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              每次领取会从 MockUSDT 合约铸造并转入你的钱包，金额固定为 {FAUCET_AMOUNT} USDT。
            </p>

            <div className="mt-6 rounded-2xl border border-border/80 bg-background/60 p-5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">MockUSDT 合约</span>
                <span className="font-mono text-xs text-foreground">
                  {mockUsdtAddress || '未配置'}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">当前钱包地址</span>
                <span className="font-mono text-xs text-foreground">
                  {mounted ? (address ?? '未连接') : '连接中...'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFaucet}
              disabled={!isConnected || isMinting || !mockUsdtAddress}
              className="mt-6 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_45px_rgba(76,106,255,0.35)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isMinting ? '领取中...' : '领取 1000 USDT'}
            </button>

            {walletState.message && (
              <div
                className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                  walletState.status === 'error'
                    ? 'border-destructive/40 bg-destructive/15 text-destructive'
                    : 'border-primary/30 bg-primary/10 text-primary'
                }`}
              >
                {walletState.message}
                {walletState.txHash && (
                  <span className="mt-2 block font-mono text-xs text-muted-foreground">
                    tx: {walletState.txHash}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border/70 bg-gradient-to-b from-card/70 to-background/70 p-8 backdrop-blur">
            <h2 className="text-xl font-semibold">使用提示</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>确保连接 Sepolia 网络的钱包。</li>
              <li>领取后可直接在“发布任务”流程中完成支付。</li>
              <li>若钱包未弹出确认，请检查浏览器插件或切换账户。</li>
            </ul>
            <div className="mt-6 rounded-2xl border border-border/60 bg-background/60 p-4 text-xs text-muted-foreground">
              如需更多测试币，可在钱包里重复点击领取按钮。
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
