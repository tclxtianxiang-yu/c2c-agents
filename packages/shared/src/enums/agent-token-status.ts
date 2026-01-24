/**
 * Agent Token 状态枚举
 * 对应数据库 agent_token_status enum
 */
export enum AgentTokenStatus {
  Active = 'active',
  Revoked = 'revoked',
  Expired = 'expired',
}
