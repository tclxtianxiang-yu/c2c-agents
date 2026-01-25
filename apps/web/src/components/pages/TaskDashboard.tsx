'use client';

import type { Task } from '@c2c-agents/shared';
import { type AgentStatus, OrderStatus, TaskStatus } from '@c2c-agents/shared';
import { fromMinUnit } from '@c2c-agents/shared/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useUserId } from '../../lib/useUserId';
import { Modal } from '../layout/Modal';
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
  userId: string | null;
  initialAction?: 'view' | 'auto' | 'manual';
  onClose: () => void;
  onRefresh: () => void;
};

type MatchNotice = {
  type: 'success' | 'error';
  message: string;
};

type MatchingCandidate = {
  agentId: string;
  ownerId: string;
  name: string;
  description: string;
  tags: string[];
  supportedTaskTypes: string[];
  minPrice: string;
  maxPrice: string;
  status: AgentStatus;
  queue: {
    queuedCount: number;
    capacity: number;
    available: number;
  };
};

function TaskDetailModal({
  taskId,
  userId,
  initialAction = 'view',
  onClose,
  onRefresh,
}: TaskDetailModalProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<MatchNotice | null>(null);
  const [autoMatching, setAutoMatching] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [candidates, setCandidates] = useState<MatchingCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectingAgentId, setSelectingAgentId] = useState<string | null>(null);
  const [actionTriggered, setActionTriggered] = useState(false);

  useEffect(() => {
    setNotice(null);
    setManualOpen(false);
    setCandidates([]);
    setCandidatesError(null);
    setSelectingAgentId(null);
    setActionTriggered(false);
  }, []);

  const loadTask = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Task>(`/tasks/${taskId}`);
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  const loadCandidates = useCallback(async () => {
    if (!userId) {
      setCandidatesError('请先连接钱包');
      return;
    }
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const data = await apiFetch<MatchingCandidate[]>(`/matching/candidates?taskId=${taskId}`, {
        headers: {
          'x-user-id': userId,
        },
      });
      setCandidates(data);
    } catch (err) {
      setCandidatesError(err instanceof Error ? err.message : '加载候选 Agent 失败');
    } finally {
      setCandidatesLoading(false);
    }
  }, [taskId, userId]);

  const handleAutoMatch = useCallback(async () => {
    if (!userId) {
      setNotice({ type: 'error', message: '请先连接钱包' });
      return;
    }
    setAutoMatching(true);
    setNotice(null);
    try {
      const result = await apiFetch<
        | { result: 'pairing'; orderId: string; agentId: string; status: string }
        | {
            result: 'queued';
            orderId: string;
            agentId: string;
            queuePosition: number;
            queuedCount: number;
            capacity: number;
          }
      >('/matching/auto', {
        method: 'POST',
        headers: {
          'x-user-id': userId,
        },
        body: JSON.stringify({ taskId }),
      });

      if (result.result === 'pairing') {
        setNotice({ type: 'success', message: '已进入拟成单，等待对方确认。' });
      } else {
        setNotice({
          type: 'success',
          message: `已加入队列，当前排队序号 ${result.queuePosition}。`,
        });
      }
      onRefresh();
      await loadTask();
    } catch (err) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : '自动匹配失败' });
    } finally {
      setAutoMatching(false);
    }
  }, [loadTask, onRefresh, taskId, userId]);

  const handleManualSelect = useCallback(async () => {
    setManualOpen(true);
    if (!candidates.length) {
      await loadCandidates();
    }
  }, [candidates.length, loadCandidates]);

  const handleSelectAgent = useCallback(
    async (agentId: string) => {
      if (!userId) {
        setNotice({ type: 'error', message: '请先连接钱包' });
        return;
      }
      setSelectingAgentId(agentId);
      setNotice(null);
      try {
        const result = await apiFetch<
          | { result: 'pairing'; orderId: string; agentId: string; status: string }
          | {
              result: 'queued';
              orderId: string;
              agentId: string;
              queuePosition: number;
              queuedCount: number;
              capacity: number;
            }
        >('/matching/manual', {
          method: 'POST',
          headers: {
            'x-user-id': userId,
          },
          body: JSON.stringify({ taskId, agentId }),
        });

        if (result.result === 'pairing') {
          setNotice({ type: 'success', message: '已进入拟成单，等待对方确认。' });
        } else {
          setNotice({
            type: 'success',
            message: `已加入队列，当前排队序号 ${result.queuePosition}。`,
          });
        }
        onRefresh();
        await loadTask();
        setManualOpen(false);
      } catch (err) {
        setNotice({ type: 'error', message: err instanceof Error ? err.message : '选择失败' });
      } finally {
        setSelectingAgentId(null);
      }
    },
    [loadTask, onRefresh, taskId, userId]
  );

  useEffect(() => {
    if (!task || actionTriggered) return;
    if (initialAction === 'auto') {
      setActionTriggered(true);
      void handleAutoMatch();
      return;
    }
    if (initialAction === 'manual') {
      setActionTriggered(true);
      void handleManualSelect();
    }
  }, [actionTriggered, handleAutoMatch, handleManualSelect, initialAction, task]);

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-4xl">
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

      {notice && (
        <div
          className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
            notice.type === 'error'
              ? 'border-destructive/40 bg-destructive/15 text-destructive'
              : 'border-primary/30 bg-primary/10 text-primary'
          }`}
        >
          {notice.message}
        </div>
      )}
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

          {task.status === TaskStatus.Published && task.currentStatus === OrderStatus.Standby && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleAutoMatch}
                disabled={autoMatching}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_rgba(14,116,219,0.35)] transition hover:opacity-90 disabled:opacity-60"
              >
                <span aria-hidden="true">⚡</span>
                {autoMatching ? '匹配中...' : '自动匹配 (Auto Match)'}
              </button>
              <button
                type="button"
                onClick={handleManualSelect}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              >
                <span aria-hidden="true">🖐️</span>
                手动选择 (Select)
              </button>
            </div>
          )}

          {manualOpen && (
            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    选择 Agent
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    仅展示符合任务类型与报价区间的 Agent。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="text-xs font-semibold text-muted-foreground hover:text-primary"
                >
                  关闭
                </button>
              </div>

              {candidatesLoading && (
                <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  正在加载候选 Agent...
                </div>
              )}
              {candidatesError && (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/15 p-4 text-sm text-destructive">
                  {candidatesError}
                </div>
              )}
              {!candidatesLoading && !candidatesError && candidates.length === 0 && (
                <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  暂无符合条件的 Agent。
                </div>
              )}
              {!candidatesLoading && !candidatesError && candidates.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {candidates.map((agent) => {
                    const isQueueFull = agent.queue.available <= 0;
                    return (
                      <div
                        key={agent.agentId}
                        className="rounded-lg border border-border bg-background/70 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {agent.description}
                            </p>
                          </div>
                          <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                            {agent.status}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {agent.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] text-muted-foreground"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>
                            报价区间：{formatReward(agent.minPrice)} -{' '}
                            {formatReward(agent.maxPrice)} USDT
                          </span>
                          <span>
                            队列：{agent.queue.queuedCount}/{agent.queue.capacity}
                          </span>
                        </div>
                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => handleSelectAgent(agent.agentId)}
                            disabled={isQueueFull || selectingAgentId === agent.agentId}
                            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-60"
                          >
                            {selectingAgentId === agent.agentId
                              ? '提交中...'
                              : isQueueFull
                                ? '队列已满'
                                : '选择此 Agent'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            {task.status === TaskStatus.Archived ? (
              <span className="text-xs text-muted-foreground">该任务已归档</span>
            ) : task.status === TaskStatus.Unpaid ||
              task.currentStatus === OrderStatus.Completed ? (
              <div className="flex flex-wrap items-center gap-3">
                {!deleteConfirm && (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(true)}
                    className="rounded-full border border-destructive/50 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive"
                  >
                    删除任务
                  </button>
                )}
                {deleteConfirm && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      删除后任务将被归档，无法恢复。
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(false)}
                      className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted-foreground"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!userId) {
                          setError('请先连接钱包');
                          return;
                        }
                        setDeleting(true);
                        setError(null);
                        try {
                          await apiFetch<{ taskId: string; status: string }>(`/tasks/${task.id}`, {
                            method: 'DELETE',
                            headers: {
                              'x-user-id': userId,
                            },
                          });
                          onRefresh();
                          onClose();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : '删除失败');
                        } finally {
                          setDeleting(false);
                        }
                      }}
                      disabled={deleting}
                      className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
                    >
                      {deleting ? '删除中...' : '确认删除'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">仅未支付或已完成的任务可删除。</span>
            )}
          </div>
        </section>
      )}
    </Modal>
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
  const [modalAction, setModalAction] = useState<'view' | 'auto' | 'manual'>('view');
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

  const handleViewDetail = (taskId: string) => {
    setIsCreateOpen(false);
    setSelectedTaskId(taskId);
    setModalAction('view');
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <TopNav />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">任务总览</h1>
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
            <TaskCard key={task.id} task={task} onViewStatus={handleViewDetail} />
          ))}
        </section>
      </div>

      {isCreateOpen && (
        <Modal onClose={() => setIsCreateOpen(false)}>
          <CreateTaskForm
            onClose={() => setIsCreateOpen(false)}
            onSuccess={handleTaskPublished}
            onViewDetail={handleViewDetail}
          />
        </Modal>
      )}

      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          userId={userId}
          initialAction={modalAction}
          onRefresh={() => setRefreshKey((current) => current + 1)}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </main>
  );
}
