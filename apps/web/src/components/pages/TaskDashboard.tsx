'use client';

import type { OrderStatus, Task, TaskStatus } from '@c2c-agents/shared';
import { fromMinUnit } from '@c2c-agents/shared/utils';
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

const USDT_DECIMALS = 6;

function formatReward(minUnitAmount: string): string {
  const full = fromMinUnit(minUnitAmount, USDT_DECIMALS);
  const [whole, fraction] = full.split('.');
  const display = fraction ? `${whole}.${fraction.slice(0, 2)}` : whole;
  return Number(display).toLocaleString();
}

type TaskDetailModalProps = {
  taskId: string;
  onClose: () => void;
};

function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    apiFetch<Task>(`/tasks/${taskId}`)
      .then((data) => {
        if (isMounted) setTask(data);
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
  }, [taskId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10">
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur"
        onClick={onClose}
        aria-label="关闭任务详情弹窗"
      />
      <div className="relative w-full max-w-4xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">任务详情</p>
            <h2 className="mt-2 text-2xl font-semibold">查看任务状态</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            关闭
          </button>
        </div>

        {loading && (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            正在加载任务信息...
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/15 p-6 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && task && (
          <section className="mt-6 rounded-xl border border-border bg-background/70 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">任务标题</p>
                <h3 className="mt-1 text-xl font-semibold">{task.title}</h3>
              </div>
              <div className="rounded-full border border-border bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
                {task.status}
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">当前订单状态</p>
                <p className="mt-2 text-lg font-semibold text-primary">
                  {task.currentStatus ?? '暂无'}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">赏金金额</p>
                <p className="mt-2 text-lg font-semibold text-primary">
                  {formatReward(task.expectedReward)} USDT
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-muted-foreground">任务描述</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
            </div>

            {task.lastPayTxHash && (
              <div className="mt-6 rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">支付交易哈希</p>
                <p className="mt-2 break-all font-mono text-xs text-foreground">
                  {task.lastPayTxHash}
                </p>
              </div>
            )}

            {task.payFailReason && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
                支付失败原因：{task.payFailReason}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export function TaskDashboard({ scope }: TaskDashboardProps) {
  const { userId, isConnected } = useUserId('A');
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState<{ status?: TaskStatus; currentStatus?: OrderStatus }>({});
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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
            <TaskCard key={task.id} task={task} onViewStatus={setSelectedTaskId} />
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

      {selectedTaskId && (
        <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
    </main>
  );
}
