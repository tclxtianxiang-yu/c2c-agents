'use client';

import type { Agent, TaskType } from '@c2c-agents/shared';
import { AgentStatus } from '@c2c-agents/shared';
import { fromMinUnit, toMinUnit } from '@c2c-agents/shared/utils';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@c2c-agents/ui';
import { useEffect, useState } from 'react';

import { TokenSelector } from '@/components/token';
import { apiFetch } from '@/lib/api';
import { useUserId } from '@/lib/useUserId';
import { AGENT_STATUS_LABELS } from '@/utils/agentStatusLabels';
import { formatCurrency } from '@/utils/formatCurrency';
import { TASK_TYPE_LABELS } from '@/utils/taskLabels';

const USDT_DECIMALS = 6;

type AgentDetailModalProps = {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentUpdated?: (agent: Agent) => void;
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; className: string; dotColor: string }> = {
  [AgentStatus.Idle]: {
    label: AGENT_STATUS_LABELS[AgentStatus.Idle],
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
  },
  [AgentStatus.Busy]: {
    label: AGENT_STATUS_LABELS[AgentStatus.Busy],
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    dotColor: 'bg-yellow-500',
  },
  [AgentStatus.Queueing]: {
    label: AGENT_STATUS_LABELS[AgentStatus.Queueing],
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    dotColor: 'bg-blue-500',
  },
};

function getInitials(name: string) {
  const normalized = name.trim();
  if (!normalized) return '?';
  const parts = normalized.split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export function AgentDetailModal({
  agent: initialAgent,
  open,
  onOpenChange,
  onAgentUpdated,
}: AgentDetailModalProps) {
  const { userId } = useUserId('B');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local agent state to display latest data after editing
  const [localAgent, setLocalAgent] = useState<Agent | null>(initialAgent);

  // Sync local agent when prop changes (e.g., different agent opened)
  useEffect(() => {
    setLocalAgent(initialAgent);
  }, [initialAgent]);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editMastraUrl, setEditMastraUrl] = useState('');
  const [editMastraTokenId, setEditMastraTokenId] = useState<string | null>(null);
  const [editTags, setEditTags] = useState('');
  const [editSupportedTaskTypes, setEditSupportedTaskTypes] = useState<TaskType[]>([]);
  const [editMinPrice, setEditMinPrice] = useState('');
  const [editMaxPrice, setEditMaxPrice] = useState('');

  // Use local agent for display
  const agent = localAgent;

  if (!agent) return null;

  const isOwner = userId && userId === agent.ownerId;
  const statusConfig = STATUS_CONFIG[agent.status];
  const minPrice = formatCurrency(agent.minPrice);
  const maxPrice = formatCurrency(agent.maxPrice);
  const capabilities =
    agent.tags.length > 0
      ? agent.tags
      : agent.supportedTaskTypes.map((type) => `#${TASK_TYPE_LABELS[type] ?? type}`);

  const taskTypeOptions = Object.entries(TASK_TYPE_LABELS);

  const handleEnterEditMode = () => {
    setEditName(agent.name);
    setEditDescription(agent.description);
    setEditAvatarUrl(agent.avatarUrl ?? '');
    setEditMastraUrl(agent.mastraUrl);
    setEditMastraTokenId(agent.mastraTokenId ?? null);
    setEditTags(agent.tags.join(', '));
    setEditSupportedTaskTypes([...agent.supportedTaskTypes]);
    setEditMinPrice(fromMinUnit(agent.minPrice, USDT_DECIMALS));
    setEditMaxPrice(fromMinUnit(agent.maxPrice, USDT_DECIMALS));
    setError(null);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setError(null);
  };

  const toggleTaskType = (type: TaskType) => {
    setEditSupportedTaskTypes((current) =>
      current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    );
  };

  const handleSave = async () => {
    if (!userId) {
      setError('请先连接钱包');
      return;
    }

    // Validation
    if (!editName.trim()) {
      setError('Agent 名称不能为空');
      return;
    }
    if (!editDescription.trim()) {
      setError('Agent 描述不能为空');
      return;
    }
    if (!editMastraUrl.trim()) {
      setError('Mastra Cloud URL 不能为空');
      return;
    }
    if (editSupportedTaskTypes.length === 0) {
      setError('请至少选择一个支持的任务类型');
      return;
    }

    const minPriceNum = Number.parseFloat(editMinPrice);
    const maxPriceNum = Number.parseFloat(editMaxPrice);

    if (Number.isNaN(minPriceNum) || minPriceNum < 0) {
      setError('最低报价必须是非负数');
      return;
    }
    if (Number.isNaN(maxPriceNum) || maxPriceNum < 0) {
      setError('最高报价必须是非负数');
      return;
    }
    if (minPriceNum > maxPriceNum) {
      setError('最低报价不能大于最高报价');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const tagList = editTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const updatedAgent = await apiFetch<Agent>(`/agents/${agent.id}`, {
        method: 'PATCH',
        headers: {
          'x-user-id': userId,
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
          avatarUrl: editAvatarUrl.trim() || null,
          mastraUrl: editMastraUrl.trim(),
          mastraTokenId: editMastraTokenId,
          tags: tagList,
          supportedTaskTypes: editSupportedTaskTypes,
          minPrice: toMinUnit(editMinPrice, USDT_DECIMALS),
          maxPrice: toMinUnit(editMaxPrice, USDT_DECIMALS),
        }),
      });

      // Update local state to display latest data
      setLocalAgent(updatedAgent);
      setIsEditMode(false);
      onAgentUpdated?.(updatedAgent);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // Edit Mode View
  if (isEditMode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <svg
                aria-hidden="true"
                className="h-5 w-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              编辑 Agent
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-5">
            {/* Name */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Agent 名称 <span className="text-destructive">*</span>
              </span>
              <input
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="例如：智能合约审计专家"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </label>

            {/* Description */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Agent 描述 <span className="text-destructive">*</span>
              </span>
              <textarea
                className="min-h-[100px] rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
                placeholder="详细描述您的 Agent 的能力、擅长领域和特点..."
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </label>

            {/* Avatar URL */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">头像 URL</span>
              <input
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="https://example.com/avatar.png（可选）"
                value={editAvatarUrl}
                onChange={(e) => setEditAvatarUrl(e.target.value)}
              />
            </label>

            {/* Mastra URL */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                Mastra Cloud URL <span className="text-destructive">*</span>
              </span>
              <input
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="https://mastra.cloud/your-agent"
                value={editMastraUrl}
                onChange={(e) => setEditMastraUrl(e.target.value)}
              />
            </label>

            {/* Mastra Token */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Mastra Access Token</span>
              {userId ? (
                <TokenSelector
                  userId={userId}
                  value={editMastraTokenId}
                  onChange={setEditMastraTokenId}
                  disabled={isSaving}
                  placeholder="选择 Token（可选）"
                />
              ) : (
                <div className="h-10 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                  请先连接钱包
                </div>
              )}
              <span className="text-xs text-muted-foreground">
                可选，用于 Agent 调用鉴权的 Access Token
              </span>
            </div>

            {/* Supported Task Types */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">
                支持的任务类型 <span className="text-destructive">*</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {taskTypeOptions.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleTaskType(value as TaskType)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      editSupportedTaskTypes.includes(value as TaskType)
                        ? 'bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30'
                        : 'bg-muted border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">标签</span>
              <input
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                placeholder="例如：Solidity, Security, DeFi（多个标签用逗号分隔）"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
              />
            </label>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  最低报价 (USDT) <span className="text-destructive">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="50"
                  value={editMinPrice}
                  onChange={(e) => setEditMinPrice(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  最高报价 (USDT) <span className="text-destructive">*</span>
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  placeholder="500"
                  value={editMaxPrice}
                  onChange={(e) => setEditMaxPrice(e.target.value)}
                />
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                )}
                {isSaving ? '保存中...' : '保存修改'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Detail View
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Agent 详情</DialogTitle>
        </DialogHeader>

        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Avatar className="h-20 w-20 flex-shrink-0 rounded-xl border-2 border-border">
            <AvatarImage src={agent.avatarUrl ?? undefined} alt={agent.name} />
            <AvatarFallback className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-xl font-bold text-primary">
              {getInitials(agent.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-foreground">{agent.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full border bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-600 border-cyan-500/20">
                <svg
                  aria-hidden="true"
                  className="h-3 w-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6 0L7.545 4.13L12 4.635L8.73 7.455L9.708 12L6 9.885L2.292 12L3.27 7.455L0 4.635L4.455 4.13L6 0Z"
                    fill="currentColor"
                  />
                </svg>
                VERIFIED
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${statusConfig.className}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotColor}`} />
                {statusConfig.label.toUpperCase()}
              </span>
              {isOwner && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                  我的 Agent
                </span>
              )}
            </div>

            <p className="mt-1 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              {agent.supportedTaskTypes.map((type) => TASK_TYPE_LABELS[type] ?? type).join(' / ')}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-yellow-500">⭐</span>
                <span className="font-semibold text-foreground">
                  {Number(agent.avgRating ?? 0).toFixed(1)}
                </span>
                <span className="text-muted-foreground">({agent.ratingCount ?? 0} Reviews)</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path
                    fillRule="evenodd"
                    d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-semibold text-primary">{agent.completedOrderCount ?? 0}</span>
                <span>Jobs Completed</span>
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <svg
              aria-hidden="true"
              className="h-4 w-4 text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            About this Agent
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{agent.description}</p>

          <div className="mt-4">
            <h4 className="text-xs font-semibold text-foreground">Capabilities</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {capabilities.map((cap) => (
                <span
                  key={cap}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {cap.startsWith('#') ? cap : `#${cap}`}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Quote Range & Status */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Quote Range
            </p>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-primary">{minPrice}</span>
              <span className="text-muted-foreground">~</span>
              <span className="text-2xl font-bold text-primary">{maxPrice}</span>
              <span className="ml-1 text-sm font-semibold text-primary">USDT</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Per Task Execution</p>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Current Status
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${statusConfig.dotColor}`} />
              <span className={`text-xl font-bold ${statusConfig.className.split(' ')[1]}`}>
                {statusConfig.label.toUpperCase()}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {agent.status === AgentStatus.Idle
                ? 'Available Now'
                : `Queue: ${agent.queueSize ?? 0} tasks`}
            </p>
          </div>
        </div>

        {/* Mastra Integration */}
        {agent.mastraUrl && (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <svg
                  aria-hidden="true"
                  className="h-4 w-4 text-cyan-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
                Mastra Cloud Integration
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/70 bg-background p-2">
              <svg
                aria-hidden="true"
                className="h-4 w-4 flex-shrink-0 text-emerald-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <a
                href={agent.mastraUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate font-mono text-xs text-emerald-600 hover:underline"
              >
                {agent.mastraUrl}
              </a>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {isOwner ? (
            // Owner view: Edit button
            <button
              type="button"
              onClick={handleEnterEditMode}
              className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              编辑 Agent
            </button>
          ) : (
            // Non-owner view: Select button
            <button
              type="button"
              className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              Select Agent
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:border-primary/40 hover:text-primary flex items-center justify-center gap-2"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Message Provider
          </button>
        </div>

        {/* Note */}
        <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
          <p className="text-xs text-cyan-600">
            <span className="font-semibold">Note:</span> Payment is held in smart contract escrow
            until task verification
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
