-- ============================================================
-- Queue consume_next 原子操作函数
-- ============================================================
-- 注意：此文件需要由 Owner #1 添加到 infra/supabase/migrations/
-- 用于实现队列的原子消费操作（FOR UPDATE SKIP LOCKED）
-- ============================================================

CREATE OR REPLACE FUNCTION public.consume_next_queue_item(p_agent_id UUID)
RETURNS SETOF public.queue_items
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.queue_items
  SET
    status = 'consumed',
    consumed_at = NOW()
  WHERE id = (
    SELECT id
    FROM public.queue_items
    WHERE agent_id = p_agent_id AND status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

COMMENT ON FUNCTION public.consume_next_queue_item(UUID) IS
'原子消费队列中最早的项。使用 FOR UPDATE SKIP LOCKED 确保并发安全。';

-- 使用示例：
-- SELECT * FROM public.consume_next_queue_item('agent-uuid-here');
