-- ============================================================
-- Agent Embeddings for Vector Search
-- Tech: Supabase + pgvector
-- ============================================================

-- 启用 pgvector 扩展
create extension if not exists vector with schema extensions;

-- ============================================================
-- agent_embeddings 表
-- 存储 Agent 的向量化信息，用于语义搜索
-- ============================================================

create table if not exists public.agent_embeddings (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,

  -- 用于生成 embedding 的文本内容（方便调试和重新生成）
  content_text text not null,

  -- 1536 维向量 (OpenAI text-embedding-3-small)
  embedding vector(1536) not null,

  -- 使用的模型标识（便于后续升级模型时重新生成）
  model_id text not null default 'text-embedding-3-small',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agent_embeddings is
'Agent 向量化信息表：存储 Agent 描述/标签的向量化表示，用于语义搜索匹配 Task';

comment on column public.agent_embeddings.agent_id is 'Agent ID（每个 Agent 只有一条记录）';
comment on column public.agent_embeddings.content_text is '生成 embedding 的原始文本';
comment on column public.agent_embeddings.embedding is '1536 维向量（OpenAI text-embedding-3-small）';
comment on column public.agent_embeddings.model_id is '使用的 embedding 模型标识';

-- 每个 agent 只能有一条 embedding 记录
create unique index if not exists uq_agent_embeddings_agent_id
on public.agent_embeddings(agent_id);

-- 创建 HNSW 索引用于近似最近邻搜索（余弦相似度）
create index if not exists idx_agent_embeddings_vector
on public.agent_embeddings
using hnsw (embedding vector_cosine_ops);

-- updated_at 自动更新触发器
drop trigger if exists trg_agent_embeddings_updated_at on public.agent_embeddings;
create trigger trg_agent_embeddings_updated_at
before update on public.agent_embeddings
for each row execute function public.set_updated_at();

-- ============================================================
-- 向量相似度搜索函数
-- ============================================================

create or replace function public.match_agents_by_embedding(
  query_embedding vector(1536),
  match_threshold float default 0.5,
  match_count int default 15
)
returns table (
  agent_id uuid,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ae.agent_id,
    1 - (ae.embedding <=> query_embedding) as similarity
  from public.agent_embeddings ae
  inner join public.agents a on a.id = ae.agent_id
  where
    a.is_listed = true
    and 1 - (ae.embedding <=> query_embedding) > match_threshold
  order by ae.embedding <=> query_embedding
  limit match_count;
end;
$$;

comment on function public.match_agents_by_embedding is
'基于向量相似度搜索匹配的 Agent，返回相似度高于阈值的前 N 个结果';
