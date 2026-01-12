'use client';

import type { OrderStatus, TaskStatus } from '@c2c-agents/shared';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { TaskCard, type TaskSummary } from '../components/tasks/TaskCard';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { apiFetch } from '../lib/api';

export default function Home() {
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [scope, setScope] = useState<'mine' | 'market'>('mine');
  const [filters, setFilters] = useState<{ status?: TaskStatus; currentStatus?: OrderStatus }>({});
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = address ?? '';

  useEffect(() => {
    setMounted(true);
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    if (filters.status) params.set('status', filters.status);
    if (filters.currentStatus) params.set('currentStatus', filters.currentStatus);
    return params.toString();
  }, [scope, filters]);

  useEffect(() => {
    if (scope === 'mine' && !userId) {
      setTasks([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiFetch<TaskSummary[]>(`/tasks?${queryString}` as const, {
      headers: userId ? { 'x-user-id': userId } : undefined,
      cache: 'no-store',
    })
      .then((data) => {
        if (isMounted) setTasks(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message ?? '加载失败');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [queryString, userId, scope]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold">
                AI
              </div>
              <div className="hidden lg:block">
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                  Agent Square
                </p>
                <p className="text-sm font-semibold text-foreground">任务广场</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-card p-1 text-xs">
              <button
                type="button"
                onClick={() => setScope('mine')}
                className={`rounded-full px-4 py-1 font-semibold transition ${
                  scope === 'mine'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                我是发布者
              </button>
              <button
                type="button"
                onClick={() => setScope('market')}
                className={`rounded-full px-4 py-1 font-semibold transition ${
                  scope === 'market'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                我是 Agent 提供者
              </button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-between gap-3 lg:justify-end">
            <div className="relative hidden flex-1 lg:block">
              <input
                className="w-full rounded-full border border-input bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="Search tasks, agents, tags..."
                type="text"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                ⌕
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ConnectButton />
              <Link
                className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
                href="/tasks/create"
              >
                发布任务
              </Link>
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pb-3 md:hidden">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 text-xs">
            <button
              type="button"
              onClick={() => setScope('mine')}
              className={`flex-1 rounded-lg px-3 py-2 font-semibold ${
                scope === 'mine' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              发布者
            </button>
            <button
              type="button"
              onClick={() => setScope('market')}
              className={`flex-1 rounded-lg px-3 py-2 font-semibold ${
                scope === 'market' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              Agent
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-primary">
              <span className="uppercase tracking-[0.3em] font-semibold">Task Square</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">v0.1 (Beta)</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold">Dashboard Overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Monitor escrow payments, review pairing status, and manage your task flow in one
              place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              Filter
            </button>
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              Export
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto border-b border-border pb-2 text-sm text-muted-foreground">
          {[
            { key: 'Standby', label: '待机 (Standby)' },
            { key: 'Pairing', label: '拟成单 (Pairing)' },
            { key: 'InProgress', label: '进行中 (In Progress)' },
            { key: 'Delivered', label: '待验收 (Awaiting)' },
            { key: 'Disputed', label: '争议 (Disputed)' },
            { key: 'Completed', label: '已完成 (Completed)' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  currentStatus: tab.key as OrderStatus,
                }))
              }
              className={`whitespace-nowrap border-b-2 pb-2 text-sm font-semibold transition ${
                filters.currentStatus === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, currentStatus: undefined }))}
            className="whitespace-nowrap pb-2 text-xs text-muted-foreground hover:text-foreground"
          >
            清除筛选
          </button>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <TaskFilters
            status={filters.status}
            currentStatus={filters.currentStatus}
            onChange={(next) => setFilters(next)}
          />
        </div>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {loading && (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              正在加载任务列表...
            </div>
          )}
          {error && (
            <div className="col-span-full rounded-lg border border-destructive/40 bg-destructive/15 p-8 text-center text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && tasks.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              {scope === 'mine'
                ? mounted && isConnected
                  ? '还没有任务，先发布一个试试。'
                  : '请先连接钱包查看我的任务。'
                : '当前任务广场暂无 Standby 任务。'}
            </div>
          )}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </section>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;900&display=swap');
        body {
          font-family: 'Public Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
      `}</style>
    </main>
  );
}
