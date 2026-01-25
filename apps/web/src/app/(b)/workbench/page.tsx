'use client';

import { useState } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { useUserId } from '@/lib/useUserId';
import { DeliveredTab, HistoryTab, InProgressTab, PairingTab, QueueTab } from './_components';

type TabKey = 'pairing' | 'in-progress' | 'delivered' | 'queue' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pairing', label: '拟成单' },
  { key: 'in-progress', label: '进行中' },
  { key: 'delivered', label: '已交付' },
  { key: 'queue', label: '队列' },
  { key: 'history', label: '历史' },
];

export default function WorkbenchPage() {
  const { userId, loading: userLoading } = useUserId('B');
  const [activeTab, setActiveTab] = useState<TabKey>('pairing');

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(24,36,70,0.6),rgba(10,14,30,0.95))] text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <section className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-[0_35px_80px_rgba(8,12,28,0.55)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Workbench</p>
          <h1 className="mt-3 text-3xl font-semibold">B 侧工作台</h1>
          <p className="mt-2 text-sm text-muted-foreground">管理您的订单、交付和队列。</p>
        </section>

        {userLoading ? (
          <div className="text-center text-muted-foreground">加载用户信息...</div>
        ) : !userId ? (
          <div className="text-center text-muted-foreground">请先连接钱包</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-card/60 p-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <section className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
              {activeTab === 'pairing' && <PairingTab userId={userId} />}
              {activeTab === 'in-progress' && <InProgressTab userId={userId} />}
              {activeTab === 'delivered' && <DeliveredTab userId={userId} />}
              {activeTab === 'queue' && <QueueTab userId={userId} />}
              {activeTab === 'history' && <HistoryTab userId={userId} />}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
