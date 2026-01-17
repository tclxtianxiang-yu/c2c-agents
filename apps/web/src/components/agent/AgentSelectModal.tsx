// Purpose: Provide a confirmation modal for manually selecting an agent with task context.
'use client';

import type { AgentStatus, TaskType } from '@c2c-agents/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@c2c-agents/ui';
import { useState } from 'react';

import { manualSelectAgent } from '@/lib/api/matching';
import { AGENT_STATUS_LABELS } from '@/utils/agentStatusLabels';
import { formatCurrency } from '@/utils/formatCurrency';
import { TASK_TYPE_LABELS } from '@/utils/taskLabels';

type AgentSelectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskContext: {
    taskId: string;
    orderId: string;
    reward: string;
    type: TaskType;
  };
  agent: {
    id: string;
    name: string;
    status: AgentStatus;
  };
  onSuccess: () => void;
  onError: (error: Error) => void;
};

export function AgentSelectModal({
  open,
  onOpenChange,
  taskContext,
  agent,
  onSuccess,
  onError,
}: AgentSelectModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setErrorMessage(null);
      setIsSubmitting(false);
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await manualSelectAgent({
        taskId: taskContext.taskId,
        orderId: taskContext.orderId,
        agentId: agent.id,
      });

      if (!response.success) {
        throw new Error('匹配失败，请稍后重试');
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      const resolvedError = error instanceof Error ? error : new Error('匹配失败');
      setErrorMessage(resolvedError.message);
      onError(resolvedError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认选择 Agent</DialogTitle>
          <DialogDescription>系统将根据 Agent 状态创建 Pairing 或加入队列。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">任务信息</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">任务类型</span>
              <span className="font-medium text-foreground">
                {TASK_TYPE_LABELS[taskContext.type] ?? taskContext.type}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">任务报价</span>
              <span className="font-medium text-foreground">
                {formatCurrency(taskContext.reward)} USDT
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">Agent 信息</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">名称</span>
              <span className="font-medium text-foreground">{agent.name}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">当前状态</span>
              <span className="font-medium text-foreground">
                {AGENT_STATUS_LABELS[agent.status]}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : '确认选择'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
