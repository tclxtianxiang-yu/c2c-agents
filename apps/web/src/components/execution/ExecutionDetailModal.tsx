'use client';

import type { Agent, Execution } from '@c2c-agents/shared';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@c2c-agents/ui';

type ExecutionWithAgent = Execution & {
  agent: Pick<
    Agent,
    'id' | 'name' | 'supportedTaskTypes' | 'avgRating' | 'completedOrderCount' | 'status'
  > | null;
};

type Props = {
  execution: ExecutionWithAgent | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void;
  isSelected: boolean;
};

export function ExecutionDetailModal({ execution, isOpen, onClose, onSelect, isSelected }: Props) {
  if (!execution) return null;

  const { agent, status, resultPreview, resultContent, errorMessage, mastraStatus } = execution;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{agent?.name ?? 'Agent'}</span>
            <StatusBadge status={status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Agent basic info */}
          {agent && (
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Agent 信息</h4>
              <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 rounded-lg p-3">
                <div>类型: {agent.supportedTaskTypes?.join(', ') || '-'}</div>
                <div>评分: {agent.avgRating?.toFixed(1) ?? '-'}</div>
                <div>完成订单: {agent.completedOrderCount ?? 0}</div>
                <div>状态: {agent.status ?? '-'}</div>
              </div>
            </section>
          )}

          {/* Execution process */}
          {status === 'running' && (
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">执行过程</h4>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span className="text-sm text-blue-600">正在执行中...</span>
                </div>
                {mastraStatus && (
                  <p className="text-xs text-muted-foreground mt-2">Mastra 状态: {mastraStatus}</p>
                )}
              </div>
            </section>
          )}

          {/* Execution result */}
          {(status === 'completed' || status === 'selected') && (
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">执行结果</h4>
              {resultPreview && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-2">
                  <p className="text-sm font-medium text-green-700">预览</p>
                  <p className="text-sm mt-1">{resultPreview}</p>
                </div>
              )}
              {resultContent && (
                <div className="max-h-[200px] overflow-y-auto border rounded-lg p-3 bg-muted/30">
                  <pre className="text-xs whitespace-pre-wrap font-mono">{resultContent}</pre>
                </div>
              )}
              {!resultPreview && !resultContent && (
                <p className="text-sm text-muted-foreground">暂无结果内容</p>
              )}
            </section>
          )}

          {/* Error message */}
          {status === 'failed' && errorMessage && (
            <section>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">错误信息</h4>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            </section>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          {status === 'completed' && (
            <Button
              onClick={() => {
                onSelect();
                onClose();
              }}
              variant={isSelected ? 'secondary' : 'default'}
            >
              {isSelected ? '取消选择' : '选择此结果'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: '等待中' },
    running: { bg: 'bg-blue-100', text: 'text-blue-600', label: '执行中' },
    completed: { bg: 'bg-green-100', text: 'text-green-600', label: '已完成' },
    failed: { bg: 'bg-red-100', text: 'text-red-600', label: '失败' },
    selected: { bg: 'bg-purple-100', text: 'text-purple-600', label: '已选中' },
    rejected: { bg: 'bg-gray-100', text: 'text-gray-500', label: '未选中' },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
