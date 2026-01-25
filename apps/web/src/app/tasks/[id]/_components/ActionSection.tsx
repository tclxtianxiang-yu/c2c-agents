'use client';

import type { Order, Task } from '@c2c-agents/shared';
import { OrderStatus } from '@c2c-agents/shared';
import { Card } from '@c2c-agents/ui';
import { DeliveredActions } from './DeliveredActions';
import { ExecutingActions } from './ExecutingActions';
import { FinalStates } from './FinalStates';
import { InProgressStatus } from './InProgressStatus';
import { PairingActions } from './PairingActions';
import { RequestActions } from './RequestActions';
import { SelectingActions } from './SelectingActions';
import { StandbyActions } from './StandbyActions';

type ActionSectionProps = {
  task: Task;
  order: Order | null;
  initialAction?: 'auto' | 'manual';
};

export function ActionSection({ task, order, initialAction }: ActionSectionProps) {
  if (!order) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            操作区
          </p>
          <p className="mt-2 text-muted-foreground">暂无可用操作</p>
        </div>
      </Card>
    );
  }

  // Render status-specific actions
  const renderActions = () => {
    switch (order.status) {
      case OrderStatus.Standby:
        return <StandbyActions task={task} order={order} initialAction={initialAction} />;

      case OrderStatus.Pairing:
        return <PairingActions task={task} order={order} />;

      case OrderStatus.Executing: {
        // Mock user ID for demo - in real app this comes from auth context
        const executingUserId = task.creatorId;
        return <ExecutingActions task={task} order={order} currentUserId={executingUserId} />;
      }

      case OrderStatus.Selecting: {
        // Mock user ID for demo - in real app this comes from auth context
        const selectingUserId = task.creatorId;
        return <SelectingActions task={task} order={order} currentUserId={selectingUserId} />;
      }

      case OrderStatus.InProgress:
        return <InProgressStatus task={task} order={order} />;

      case OrderStatus.Delivered:
        return <DeliveredActions task={task} order={order} />;

      case OrderStatus.RefundRequested:
      case OrderStatus.CancelRequested: {
        //  A hardcoded user ID for demonstration.
        // In a real app, this would come from an auth context.
        // To test the actions for the other party, we use a different ID.
        // For RefundRequested (by creator), we'd be the provider.
        // For CancelRequested (by provider), we'd be the creator.
        const mockProviderId = '00000000-0000-0000-0000-000000000001';
        const currentUserId =
          order.status === OrderStatus.RefundRequested ? mockProviderId : task.creatorId;

        return <RequestActions task={task} order={order} currentUserId={currentUserId} />;
      }

      case OrderStatus.Disputed:
      case OrderStatus.AdminArbitrating:
      case OrderStatus.Completed:
      case OrderStatus.Refunded:
      case OrderStatus.Paid:
      case OrderStatus.Accepted:
      case OrderStatus.AutoAccepted: {
        // 假设这是个最终状态，需要展示
        // 模拟发布者视角，以便在 Completed/Paid 状态下演示“评价 Agent”按钮
        const finalStatesUserId = task.creatorId;
        return <FinalStates task={task} order={order} currentUserId={finalStatesUserId} />;
      }

      default:
        return (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">未知状态: {order.status}</p>
          </div>
        );
    }
  };

  return <div>{renderActions()}</div>;
}
