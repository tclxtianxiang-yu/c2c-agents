-- 新增订单状态: Executing（执行中）、Selecting（选择中）
-- PostgreSQL enum 不能直接添加值到中间位置，需要重建

-- 1. 新增执行记录表
CREATE TABLE IF NOT EXISTS executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id),

  -- 执行状态: pending（待执行）、running（执行中）、completed（已完成）、failed（失败）、selected（被选中）、rejected（未被选中）
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'selected', 'rejected')),

  -- Mastra 执行信息
  mastra_run_id text,           -- Mastra 返回的执行 ID
  mastra_status text,           -- Mastra 执行状态

  -- 执行结果
  result_preview text,          -- 结果预览（摘要）
  result_content text,          -- 完整结果内容
  result_url text,              -- 结果链接（如有）

  -- 错误信息
  error_message text,

  -- 时间戳
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 唯一约束：同一订单同一 Agent 只能有一条执行记录
  UNIQUE(order_id, agent_id)
);

-- 2. 为 orders 表添加执行阶段字段
ALTER TABLE orders ADD COLUMN IF NOT EXISTS execution_phase text
  CHECK (execution_phase IS NULL OR execution_phase IN ('executing', 'selecting', 'completed'));

-- 3. 索引优化
CREATE INDEX IF NOT EXISTS idx_executions_order_id ON executions(order_id);
CREATE INDEX IF NOT EXISTS idx_executions_agent_id ON executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_orders_execution_phase ON orders(execution_phase) WHERE execution_phase IS NOT NULL;

-- 4. 触发器：自动更新 updated_at（使用已有的 public.set_updated_at 函数）
DROP TRIGGER IF EXISTS trg_executions_updated_at ON executions;
CREATE TRIGGER trg_executions_updated_at
  BEFORE UPDATE ON executions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
