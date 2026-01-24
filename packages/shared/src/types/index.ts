/**
 * Core DTO Types - Based on infra/supabase/migrations/supabase_init.sql
 *
 * 关键设计决策：
 * - 金额字段使用 string（避免精度丢失，数据库 numeric(78,0) → string）
 * - 时间戳使用 string（ISO 8601 格式，便于序列化）
 * - 枚举引用已定义的 enum types
 * - 可空字段明确标注 | null
 */

import type {
  AgentStatus,
  AgentTokenStatus,
  OrderStatus,
  QueueItemStatus,
  TaskStatus,
} from '../enums';

// ============================================================
// Task Types
// ============================================================

/**
 * 任务类型枚举（来自 SQL enum）
 */
export type TaskType =
  | 'writing'
  | 'translation'
  | 'code'
  | 'website'
  | 'email_automation'
  | 'info_collection'
  | 'other_mastra';

/**
 * Task DTO - 任务（A 发布）
 * 基于 supabase_init.sql 第 328-383 行
 */
export interface Task {
  id: string; // uuid
  creatorId: string; // uuid → auth.users

  title: string;
  description: string;
  type: TaskType;
  tags: string[];

  expectedReward: string; // numeric(78,0) → string（最小单位整数）

  status: TaskStatus; // unpaid | published | archived

  currentOrderId: string | null; // uuid | null
  currentStatus: OrderStatus | null; // 镜像当前订单状态（用于列表筛选）

  lastPayTxHash: string | null; // 最近一次支付 tx hash
  payFailReason: string | null; // 支付失败原因

  createdAt: string; // timestamptz → ISO 8601
  updatedAt: string; // timestamptz → ISO 8601
}

/**
 * Task 附件关联
 * 基于 supabase_init.sql 第 386-398 行
 */
export interface TaskAttachment {
  taskId: string; // uuid
  fileId: string; // uuid
  createdAt: string; // timestamptz → ISO 8601
}

// ============================================================
// Order Types
// ============================================================

/**
 * Order DTO - 订单（执行态核心）
 * 基于 supabase_init.sql 第 404-500 行
 */
export interface Order {
  id: string; // uuid
  taskId: string; // uuid

  creatorId: string; // A (auth.users)
  providerId: string | null; // B (auth.users，Pairing 成功后才有)
  agentId: string | null; // 选定 Agent（Pairing 后确定）

  status: OrderStatus; // 订单状态机

  rewardAmount: string; // numeric(78,0) → string
  platformFeeRate: string; // numeric(10,6) → string（如 "0.15"）
  platformFeeAmount: string | null; // numeric(78,0) → string | null

  payTxHash: string | null; // A -> escrow 的 tx hash
  escrowAmount: string | null; // numeric(78,0) → string | null
  payoutTxHash: string | null; // escrow -> B/feeReceiver 的 tx hash
  refundTxHash: string | null; // escrow -> A 的 tx hash

  deliveredAt: string | null; // timestamptz → ISO 8601
  acceptedAt: string | null;
  autoAcceptedAt: string | null;
  refundedAt: string | null;
  paidAt: string | null;
  completedAt: string | null;

  refundRequestReason: string | null; // A 在 Delivered 发起退款的原因
  cancelRequestReason: string | null; // B 在 InProgress 发起中断的原因

  pairingCreatedAt: string | null; // timestamptz → ISO 8601（用于 TTL）

  createdAt: string; // timestamptz → ISO 8601
  updatedAt: string; // timestamptz → ISO 8601
}

// ============================================================
// Agent Types
// ============================================================

/**
 * Agent DTO - Agent（B 发布）
 * 基于 supabase_init.sql 第 220-288 行
 */
export interface Agent {
  id: string; // uuid
  ownerId: string; // uuid → auth.users（B 用户）

  name: string;
  description: string;
  avatarUrl: string | null;
  mastraUrl: string; // Mastra Cloud 的 Agent URL（外部执行入口）

  tags: string[];
  supportedTaskTypes: TaskType[];

  minPrice: string; // numeric(78,0) → string
  maxPrice: string; // numeric(78,0) → string

  avgRating: number; // double precision（冗余统计）
  ratingCount: number; // integer
  completedOrderCount: number; // integer

  status: AgentStatus; // Idle | Busy | Queueing
  currentOrderId: string | null; // uuid | null
  queueSize: number; // integer（冗余字段）

  isListed: boolean; // 是否上架（管理员可下架）

  createdAt: string; // timestamptz → ISO 8601
  updatedAt: string; // timestamptz → ISO 8601
}

// ============================================================
// Wallet Types
// ============================================================

/**
 * 钱包角色枚举
 */
export type WalletRole = 'A' | 'B';

/**
 * WalletBinding DTO - 钱包绑定
 * 基于 supabase_init.sql 第 294-323 行
 */
export interface WalletBinding {
  id: string; // uuid
  userId: string; // uuid → auth.users
  role: WalletRole;

  address: string; // EVM 地址（0x...）
  isActive: boolean; // 是否当前生效（同一 user+role 只能有一条 true）

  createdAt: string; // timestamptz → ISO 8601
  deactivatedAt: string | null; // timestamptz → ISO 8601 | null
}

// ============================================================
// Queue Types
// ============================================================

/**
 * QueueItem DTO - 队列项
 * 基于 supabase_init.sql 第 548-578 行
 */
export interface QueueItem {
  id: string; // uuid
  agentId: string; // uuid
  taskId: string; // uuid（冗余便于查询）
  orderId: string; // uuid

  status: QueueItemStatus; // queued | consumed | canceled

  createdAt: string; // timestamptz → ISO 8601（FIFO 排序依据）
  consumedAt: string | null; // timestamptz → ISO 8601（消费时间）
  canceledAt: string | null; // timestamptz → ISO 8601（取消时间）
}

// ============================================================
// Matching API Types
// ============================================================

export interface ManualSelectRequest {
  taskId: string;
  orderId: string;
  agentId: string;
}

export interface ManualSelectResponse {
  success: boolean;
  result: 'pairing' | 'queued';
  pairingId?: string;
  queueItemId?: string;
  queuePosition?: number;
  error?: {
    code?: string;
    message?: string;
  };
}

// ============================================================
// Delivery Types
// ============================================================

/**
 * Delivery DTO - 交付
 * 基于 supabase_init.sql 第 506-542 行
 */
export interface Delivery {
  id: string; // uuid
  orderId: string; // uuid
  providerId: string; // uuid → auth.users（B）

  contentText: string | null; // 交付文本内容
  externalUrl: string | null; // 交付外链

  submittedAt: string; // timestamptz → ISO 8601
}

/**
 * Delivery 附件关联
 */
export interface DeliveryAttachment {
  deliveryId: string; // uuid
  fileId: string; // uuid
  createdAt: string; // timestamptz → ISO 8601
}

// ============================================================
// Dispute Types
// ============================================================

/**
 * 争议状态枚举
 */
export type DisputeStatus = 'open' | 'under_review' | 'resolved';

/**
 * 争议裁决结果枚举
 */
export type DisputeResolution = 'refund_to_A' | 'pay_to_B' | 'other';

/**
 * Dispute DTO - 争议（平台介入/仲裁）
 * 基于 supabase_init.sql 第 586-625 行
 */
export interface Dispute {
  id: string; // uuid
  orderId: string; // uuid
  initiatorId: string; // uuid → auth.users（发起平台介入的一方）

  reason: string; // 平台介入时额外说明
  status: DisputeStatus;

  adminId: string | null; // uuid → auth.users（处理管理员）
  resolution: DisputeResolution | null;
  resolutionNote: string | null;
  resolvedAt: string | null; // timestamptz → ISO 8601

  createdAt: string; // timestamptz → ISO 8601
  updatedAt: string; // timestamptz → ISO 8601
}

// ============================================================
// Review Types
// ============================================================

/**
 * 评价对象类型枚举
 */
export type ReviewTargetType = 'agent' | 'user';

/**
 * Review DTO - 评价
 * 基于 supabase_init.sql 第 631-667 行
 */
export interface Review {
  id: string; // uuid
  orderId: string; // uuid

  fromUserId: string; // uuid → auth.users（评价发起人）
  toUserId: string; // uuid → auth.users（评价对象）

  targetType: ReviewTargetType; // agent | user
  rating: number; // integer（1-5）
  comment: string | null; // 文字评价

  createdAt: string; // timestamptz → ISO 8601
}

// ============================================================
// User Types
// ============================================================

/**
 * UserProfile DTO - 用户扩展资料
 * 基于 supabase_init.sql 第 159-179 行
 */
export interface UserProfile {
  userId: string; // uuid → auth.users（主键）
  displayName: string | null;
  avatarUrl: string | null;

  createdAt: string; // timestamptz → ISO 8601
  updatedAt: string; // timestamptz → ISO 8601
}

// ============================================================
// File Types
// ============================================================

/**
 * FileMetadata DTO - 文件/附件元数据
 * 基于 supabase_init.sql 第 185-215 行
 *
 * 注意：重命名为 FileMetadata 以避免与 DOM 全局 File 接口冲突
 */
export interface FileMetadata {
  id: string; // uuid
  uploaderId: string; // uuid → auth.users

  bucket: string; // Storage bucket 名称
  objectPath: string; // 对象路径（bucket 内路径）
  mimeType: string | null;
  sizeBytes: string | null; // bigint → string（避免 JS 安全整数溢出）
  sha256: string | null; // 内容哈希

  isPublic: boolean; // 是否公开可访问（默认 true）

  createdAt: string; // timestamptz → ISO 8601
}

// ============================================================
// View Types (API 输出聚合类型)
// ============================================================

/**
 * TaskWithAttachments - Task + 附件列表（用于 API 输出）
 */
export interface TaskWithAttachments extends Task {
  attachments: FileMetadata[]; // 聚合的附件列表
}

/**
 * DeliveryWithAttachments - Delivery + 附件列表（用于 API 输出）
 */
export interface DeliveryWithAttachments extends Delivery {
  attachments: FileMetadata[]; // 聚合的附件列表
}

/**
 * OrderWithRelations - Order + 关联数据（用于详情页 API）
 *
 * 注意：task 使用 TaskWithAttachments 以确保一次性获取任务附件
 */
export interface OrderWithRelations extends Order {
  task?: TaskWithAttachments; // 关联的任务（含附件）
  agent?: Agent; // 关联的 Agent
  deliveries?: DeliveryWithAttachments[]; // 交付列表（含附件）
  dispute?: Dispute; // 争议信息（如有）
}

// ============================================================
// Agent Token Types
// ============================================================

/**
 * AgentToken DTO - Agent API Token
 * 用于 Mastra Agent 调用鉴权
 */
export interface AgentToken {
  id: string; // uuid
  agentId: string; // uuid → agents.id

  name: string; // Token 名称（用户自定义）
  tokenPrefix: string; // Token 前 17 字符（UI 展示用）

  status: AgentTokenStatus; // active | revoked | expired

  expiresAt: string | null; // timestamptz → ISO 8601 | null
  lastUsedAt: string | null; // timestamptz → ISO 8601 | null

  createdAt: string; // timestamptz → ISO 8601
  revokedAt: string | null; // timestamptz → ISO 8601 | null
}

/**
 * CreateAgentTokenResponse - 创建 Token 响应
 * rawToken 只在创建时返回一次，之后无法再次获取
 */
export interface CreateAgentTokenResponse {
  token: AgentToken;
  rawToken: string; // 原始 Token（48 字符，cagt_前缀 + 43 字符 base64url）
}

// All types are already exported inline above
// No need for a separate export block
