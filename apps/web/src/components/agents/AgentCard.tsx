'use client';

import type { Agent, TaskType } from '@c2c-agents/shared';
import { AgentStatus } from '@c2c-agents/shared';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@c2c-agents/ui';
import { useId, useState } from 'react';

import { formatCurrency } from '@/utils/formatCurrency';
import { TASK_TYPE_LABELS } from '@/utils/taskLabels';

export type AgentSummary = Pick<
  Agent,
  | 'id'
  | 'name'
  | 'description'
  | 'avatarUrl'
  | 'tags'
  | 'supportedTaskTypes'
  | 'minPrice'
  | 'maxPrice'
  | 'avgRating'
  | 'ratingCount'
  | 'completedOrderCount'
  | 'status'
  | 'queueSize'
>;

type AgentCardProps = {
  agent: AgentSummary;
  /** 当前任务上下文（手动选择时带入） */
  taskContext?: {
    taskId: string;
    reward: string; // MockUSDT 最小单位
    type: TaskType;
  };
  /** 选择回调（手动选择模式） */
  onSelect?: (agentId: string) => void;
  /** 外部控制选择状态 */
  isSelecting?: boolean;
};

const agentStatusConfig: Record<AgentStatus, { label: string; className: string }> = {
  [AgentStatus.Idle]: {
    label: '空闲',
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  [AgentStatus.Busy]: {
    label: '忙碌',
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  },
  [AgentStatus.Queueing]: {
    label: '排队中',
    className: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  },
};

const QUEUE_MAX_N = Number(process.env.NEXT_PUBLIC_QUEUE_MAX_N ?? 10);
const RESOLVED_QUEUE_MAX_N = Number.isFinite(QUEUE_MAX_N) && QUEUE_MAX_N > 0 ? QUEUE_MAX_N : 10;

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

export function AgentCard({ agent, taskContext, onSelect, isSelecting }: AgentCardProps) {
  const nameId = useId();
  const [isSelectingInternal, setIsSelectingInternal] = useState(false);
  const statusConfig = agentStatusConfig[agent.status];
  const tags = agent.tags.slice(0, 3);
  const remainingTagCount = agent.tags.length - tags.length;
  const showQueue = agent.status !== AgentStatus.Idle;
  const selecting = isSelecting ?? isSelectingInternal;

  const rewardMismatch =
    taskContext !== undefined &&
    (BigInt(taskContext.reward) < BigInt(agent.minPrice) ||
      BigInt(taskContext.reward) > BigInt(agent.maxPrice));
  const queueIsFull = agent.queueSize >= RESOLVED_QUEUE_MAX_N;

  const disabledReason = rewardMismatch ? '报价不匹配' : queueIsFull ? '队列已满' : null;
  const canSelect = taskContext && !disabledReason;
  const estimatedCompletionTime =
    agent.status === AgentStatus.Idle
      ? '立即开始'
      : agent.queueSize > 0
        ? `预计 ${agent.queueSize + 1} 个工作日`
        : '预计 1 个工作日';

  const handleSelect = () => {
    if (!disabledReason && onSelect) {
      if (isSelecting === undefined) {
        setIsSelectingInternal(true);
      }
      onSelect(agent.id);
    }
  };

  const actionButton = taskContext ? (
    <Button
      type="button"
      className="w-full"
      disabled={Boolean(disabledReason) || selecting}
      onClick={handleSelect}
      aria-busy={selecting}
    >
      {selecting && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {selecting ? '选择中...' : '选择此 Agent'}
    </Button>
  ) : (
    <Button type="button" variant="outline" className="w-full">
      查看详情
    </Button>
  );

  return (
    <article
      className="group relative flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-lg transition duration-300 hover:-translate-y-1 hover:border-primary/50 focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 focus-within:ring-offset-background"
      aria-labelledby={nameId}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={agent.avatarUrl ?? undefined} alt={agent.name} />
            <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
          </Avatar>
          <div>
            <p id={nameId} className="text-lg font-semibold text-foreground">
              {agent.name}
            </p>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {agent.supportedTaskTypes.map((type) => TASK_TYPE_LABELS[type] ?? type).join(' / ')}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusConfig.className}`}
          role="img"
          aria-label={`状态：${statusConfig.label}`}
        >
          {statusConfig.label}
        </span>
      </div>

      <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-2">
        {agent.description}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] text-muted-foreground"
          >
            {tag}
          </span>
        ))}
        {remainingTagCount > 0 && (
          <span className="rounded-full border border-dashed border-border px-3 py-1 text-[11px] text-muted-foreground">
            +{remainingTagCount}
          </span>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">报价范围</span>
          <span className="font-semibold text-foreground">
            {formatCurrency(agent.minPrice)} ~ {formatCurrency(agent.maxPrice)} USDT
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-muted-foreground">
          <span>
            ⭐ {agent.avgRating.toFixed(1)} ({agent.ratingCount} 条评价)
          </span>
          <span>{agent.completedOrderCount} 单</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>预计完成</span>
          <span>{estimatedCompletionTime}</span>
        </div>
        {showQueue && (
          <div className="mt-2 text-xs text-muted-foreground">队列 {agent.queueSize}</div>
        )}
      </div>

      {taskContext && !canSelect && disabledReason && (
        <p className="mt-3 text-xs text-destructive">{disabledReason}</p>
      )}

      <div className="mt-auto pt-6">
        {disabledReason ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block w-full">{actionButton}</span>
              </TooltipTrigger>
              <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          actionButton
        )}
      </div>
    </article>
  );
}
