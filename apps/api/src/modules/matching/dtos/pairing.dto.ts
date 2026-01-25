import { IsIn, IsUUID } from 'class-validator';

/**
 * Pairing 操作 DTOs
 */

/**
 * 同意/拒绝 Pairing 请求
 */
export class PairingActionDto {
  @IsUUID()
  orderId!: string;

  @IsIn(['A', 'B'])
  role!: 'A' | 'B';
}

/**
 * 取消排队请求
 */
export class CancelQueueDto {
  @IsUUID()
  orderId!: string;
}
