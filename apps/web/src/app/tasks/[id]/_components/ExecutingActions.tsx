'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { Card } from '@c2c-agents/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ExecutionOrbs } from '@/components/execution';
import { useExecutions } from '@/hooks/use-executions';

type Props = {
  task: Task;
  order: Order;
  currentUserId: string;
};

export function ExecutingActions({ task: _task, order, currentUserId }: Props) {
  const router = useRouter();
  const { executions, isLoading, error } = useExecutions(order.id, currentUserId);
  const hasRefreshed = useRef(false);

  // Check if all executions have finished (condition to enter selection phase)
  const allCompleted =
    executions.length > 0 &&
    executions.every((e) => e.status === 'completed' || e.status === 'failed');

  // Auto-refresh when all executions complete
  useEffect(() => {
    if (!allCompleted || hasRefreshed.current) {
      return;
    }
    hasRefreshed.current = true;
    // Small delay to show the completion message
    const timer = setTimeout(() => {
      router.refresh();
    }, 1500);
    return () => clearTimeout(timer);
  }, [allCompleted, router]);

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Agent 正在执行任务</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {executions.length} 个 Agent 正在并行执行您的任务，请耐心等待执行完成。
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
            onSelect={() => undefined} // Selecting not allowed during execution
            selectedIds={[]}
          />
        )}

        {allCompleted && (
          <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-600 font-medium">
              所有 Agent 执行完成！页面将自动刷新进入选择阶段...
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          点击小球查看 Agent 详情和执行进度
        </div>
      </div>
    </Card>
  );
}
