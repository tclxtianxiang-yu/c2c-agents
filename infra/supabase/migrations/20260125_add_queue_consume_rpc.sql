-- 原子消费队列项的存储过程
-- 使用 FOR UPDATE SKIP LOCKED 实现无锁并发
CREATE OR REPLACE FUNCTION consume_next_queue_item(p_agent_id uuid)
RETURNS TABLE (
  id uuid,
  agent_id uuid,
  order_id uuid,
  task_id uuid,
  status text,
  created_at timestamptz,
  consumed_at timestamptz
) AS $$
BEGIN
  -- 原子抢占：SELECT + UPDATE 在同一事务中
  RETURN QUERY
  UPDATE queue_items qi
  SET
    status = 'consumed',
    consumed_at = NOW()
  WHERE qi.id = (
    SELECT q.id
    FROM queue_items q
    WHERE q.agent_id = p_agent_id
      AND q.status = 'queued'
    ORDER BY q.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING qi.id, qi.agent_id, qi.order_id, qi.task_id, qi.status, qi.created_at, qi.consumed_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION consume_next_queue_item IS
'Atomically consume the next queued item for an agent using FOR UPDATE SKIP LOCKED';
