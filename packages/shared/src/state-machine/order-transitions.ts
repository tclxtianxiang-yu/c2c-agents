import { OrderStatus } from '../enums';
import { InvalidTransitionError } from '../errors';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // 新流程：Standby -> Executing -> Selecting -> InProgress
  // 旧流程（兼容）：Standby -> Pairing -> InProgress
  [OrderStatus.Standby]: [OrderStatus.Executing, OrderStatus.Pairing],
  [OrderStatus.Executing]: [OrderStatus.Selecting, OrderStatus.Standby], // 执行完成进入选择，或超时回到待命
  [OrderStatus.Selecting]: [OrderStatus.Delivered, OrderStatus.Standby], // 用户选择后直接交付，或放弃回到待命
  [OrderStatus.Pairing]: [OrderStatus.InProgress, OrderStatus.Standby], // 保留兼容旧数据
  [OrderStatus.InProgress]: [OrderStatus.Delivered, OrderStatus.CancelRequested],
  [OrderStatus.Delivered]: [
    OrderStatus.Accepted,
    OrderStatus.AutoAccepted,
    OrderStatus.RefundRequested,
  ],
  [OrderStatus.Accepted]: [OrderStatus.Paid],
  [OrderStatus.AutoAccepted]: [OrderStatus.Paid],
  [OrderStatus.RefundRequested]: [OrderStatus.Disputed, OrderStatus.Refunded],
  [OrderStatus.CancelRequested]: [OrderStatus.Disputed, OrderStatus.Refunded],
  [OrderStatus.Disputed]: [
    OrderStatus.Delivered,
    OrderStatus.InProgress,
    OrderStatus.AdminArbitrating,
  ],
  [OrderStatus.AdminArbitrating]: [OrderStatus.Paid, OrderStatus.Refunded],
  [OrderStatus.Paid]: [OrderStatus.Completed],
  [OrderStatus.Refunded]: [OrderStatus.Completed],
  [OrderStatus.Completed]: [],
};

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function getAllowedTransitions(from: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[from] || [];
}
