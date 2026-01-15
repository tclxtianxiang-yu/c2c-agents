'use client';

import type { OrderStatus, TaskStatus } from '@c2c-agents/shared';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useUserId } from '../../lib/useUserId';
import { TopNav } from '../layout/TopNav';
import { TaskCard, type TaskSummary } from '../tasks/TaskCard';
import { TaskFilters } from '../tasks/TaskFilters';
import { CreateTaskForm } from './CreateTaskForm';

type TaskDashboardProps = {
  scope: 'mine' | 'market';
};

export function TaskDashboard({ scope }: TaskDashboardProps) {
  const { userId, isConnected } = useUserId('A');
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<{ status?: TaskStatus; currentStatus?: OrderStatus }>({});
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCreateOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCreateOpen]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    if (filters.status) params.set('status', filters.status);
    if (filters.currentStatus) params.set('currentStatus', filters.currentStatus);
    return params.toString();
  }, [scope, filters]);

  useEffect(() => {
    void refreshKey;
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
  }, [queryString, userId, scope, refreshKey]);

  const handleTaskPublished = () => {
    setIsCreateOpen(false);
    setRefreshKey((current) => current + 1);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-primary">
              <span className="uppercase tracking-[0.3em] font-semibold">任务广场</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground" />
              <span className="text-muted-foreground">v0.1（测试版）</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold">任务总览</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              统一查看托管支付、匹配状态与任务流转。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scope === 'mine' && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary"
              >
                发布任务
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto border-b border-border pb-2 text-sm text-muted-foreground">
          {[
            { key: 'Standby', label: '待机' },
            { key: 'Pairing', label: '拟成单' },
            { key: 'InProgress', label: '进行中' },
            { key: 'Delivered', label: '待验收' },
            { key: 'Disputed', label: '争议' },
            { key: 'Completed', label: '已完成' },
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
                : '当前任务广场暂无待机任务。'}
            </div>
          )}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </section>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur"
            onClick={() => setIsCreateOpen(false)}
            aria-label="关闭发布任务弹窗"
          />
          <div className="relative w-full max-w-5xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <CreateTaskForm
              onClose={() => setIsCreateOpen(false)}
              onSuccess={handleTaskPublished}
            />
          </div>
        </div>
      )}
    </main>
  );
}
