'use client';

import { getMockUSDTContract } from '@c2c-agents/shared/chain';
import { fromMinUnit } from '@c2c-agents/shared/utils';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { BrowserProvider } from 'ethers';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

const USDT_DECIMALS = 6;

const tabs = [
  { label: '我是发布者', href: '/task' },
  { label: '我是 Agent 提供者', href: '/agents' },
  { label: '工作台', href: '/workbench' },
  { label: '钱包', href: '/wallet' },
];

const formatWholeAmount = (minUnitAmount: string): string => {
  const full = fromMinUnit(minUnitAmount, USDT_DECIMALS);
  return full.split('.')[0] ?? full;
};

export function TopNav() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const [usdtBalance, setUsdtBalance] = useState('0');

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (pathname === '/' && href === '/task');

  const fetchUsdtBalance = useCallback(async () => {
    if (!address) return;
    const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
    if (!ethereum) {
      setUsdtBalance('0');
      return;
    }
    try {
      const provider = new BrowserProvider(ethereum as never);
      const contract = getMockUSDTContract({ provider });
      const balance = await contract.balanceOf(address);
      setUsdtBalance(formatWholeAmount(balance.toString()));
    } catch {
      setUsdtBalance('0');
    }
  }, [address]);

  useEffect(() => {
    if (!isConnected || !address) {
      setUsdtBalance('0');
      return;
    }
    fetchUsdtBalance();
  }, [address, fetchUsdtBalance, isConnected]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
              AI
            </div>
            <div className="hidden lg:block">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">智能广场</p>
              <p className="text-sm font-semibold text-foreground">任务广场</p>
            </div>
          </div>
          <div className="hidden md:flex items-start gap-2 rounded-2xl border border-border bg-card p-2 text-xs">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-full px-4 py-1 font-semibold transition ${
                  isActive(tab.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 lg:justify-end">
          <ConnectButton.Custom>
            {({ account, chain, mounted, openAccountModal, openConnectModal }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              if (!ready) {
                return (
                  <div
                    aria-hidden="true"
                    className="h-9 w-28 rounded-full border border-border bg-card opacity-0"
                  />
                );
              }

              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                  >
                    连接钱包
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  onClick={openAccountModal}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:border-primary/40 hover:text-primary"
                >
                  {connected && (
                    <span className="rounded-full bg-primary/15 px-2 py-1 text-xs font-semibold text-primary">
                      {usdtBalance} USDT
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>{account?.displayName}</span>
                  </span>
                  <span className="text-muted-foreground">▾</span>
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pb-3 md:hidden">
        <div className="flex items-start gap-2 overflow-x-auto rounded-xl border border-border bg-card p-2 text-xs">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-lg px-3 py-2 font-semibold ${
                isActive(tab.href) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;900&display=swap');
        body {
          font-family: 'Public Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
      `}</style>
    </header>
  );
}
