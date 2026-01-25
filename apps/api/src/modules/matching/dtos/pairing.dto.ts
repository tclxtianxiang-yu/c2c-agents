/**
 * Pairing 操作 DTOs
 */

/**
 * 同意/拒绝 Pairing 请求
 */
export type PairingActionDto = {
  orderId: string;
  role: 'A' | 'B';
};

/**
 * 取消排队请求
 */
export type CancelQueueDto = {
  orderId: string;
};
