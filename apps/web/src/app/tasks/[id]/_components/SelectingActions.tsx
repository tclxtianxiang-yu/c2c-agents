'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { Button, Card } from '@c2c-agents/ui';
import { useState } from 'react';
import { ExecutionOrbs } from '@/components/execution';
import { useExecutions } from '@/hooks/use-executions';

type Props = {
  task: Task;
  order: Order;
  currentUserId: string;
};

export function SelectingActions({ task: _task, order, currentUserId }: Props) {
  const { executions, isLoading, error } = useExecutions(order.id, currentUserId);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Only show completed executions for selection
  const completedExecutions = executions.filter((e) => e.status === 'completed');

  const handleSelect = (executionId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(executionId)) {
        return prev.filter((id) => id !== executionId);
      }
      // Maximum 3 selections
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, executionId];
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/execution/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId,
        },
        body: JSON.stringify({
          orderId: order.id,
          selectedExecutionIds: selectedIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to submit selection');
      }

      // Refresh page or reload data
      window.location.reload();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">选择执行结果</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {completedExecutions.length} 个 Agent 已完成执行，请选择您满意的结果（0-3 个）。
          </p>
        </div>

        {isLoading && executions.length === 0 ? (
          <div className="flex items-center justify-center h-[300px]">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-8">加载失败: {error}</div>
        ) : (
          <ExecutionOrbs
            executions={executions}
            onSelect={handleSelect}
            selectedIds={selectedIds}
          />
        )}

        <div className="text-xs text-muted-foreground text-center">
          点击小球查看详情，点击「选择此结果」按钮选中（可多选）
        </div>

        {/* Selection status */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <span className="text-sm font-medium">已选择: </span>
            <span className="text-lg font-bold text-primary">{selectedIds.length}</span>
            <span className="text-sm text-muted-foreground"> / 3</span>
          </div>
          <div className="text-sm text-muted-foreground">选择 0 个将放弃本次任务</div>
        </div>

        {submitError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-600">{submitError}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setSelectedIds([])}
            disabled={selectedIds.length === 0 || isSubmitting}
            className="flex-1"
          >
            清空选择
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
            {isSubmitting
              ? '提交中...'
              : selectedIds.length === 0
                ? '放弃并返回'
                : `确认选择 (${selectedIds.length})`}
          </Button>
        </div>
      </div>
    </Card>
  );
}
