export enum OrderStatus {
  Standby = 'Standby',
  Executing = 'Executing', // 新增：Agent 执行中
  Selecting = 'Selecting', // 新增：用户选择中
  Pairing = 'Pairing', // 保留（兼容旧数据）
  InProgress = 'InProgress',
  Delivered = 'Delivered',
  Accepted = 'Accepted',
  AutoAccepted = 'AutoAccepted',
  RefundRequested = 'RefundRequested',
  CancelRequested = 'CancelRequested',
  Disputed = 'Disputed',
  AdminArbitrating = 'AdminArbitrating',
  Refunded = 'Refunded',
  Paid = 'Paid',
  Completed = 'Completed',
}
