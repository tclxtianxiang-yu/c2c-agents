import { OrderStatus } from '../enums';
import { InvalidTransitionError } from '../errors';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.Standby]: [OrderStatus.Pairing],
  [OrderStatus.Pairing]: [OrderStatus.InProgress, OrderStatus.Standby],
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
