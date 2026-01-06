-- ============================================================
-- Supabase(PostgreSQL) Schema for MVP PRD
-- Tech: Supabase + Postgres
-- Notes:
-- 1) 主键统一用 uuid，默认 gen_random_uuid()
-- 2) 金额字段用 numeric(78,0) 表示“最小单位整数”（适配 6/18 decimals）
-- 3) 业务用户使用 auth.users；本库用 user_id(uuid) 外键引用 auth.users(id)
-- ============================================================

-- 必需扩展（Supabase 通常已启用 pgcrypto）
create extension if not exists pgcrypto;

-- ============================================================
-- 0) 通用：updated_at 自动更新触发器
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
'通用触发器：在 UPDATE 时自动写入 updated_at = now()';

-- ============================================================
-- 1) ENUM Types
-- ============================================================

-- Task 平台层状态（只表达任务是否已支付发布、是否归档）
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('unpaid', 'published', 'archived');
  end if;
end$$;

comment on type public.task_status is
'Task 平台层状态：unpaid=未完成链上支付校验；published=已发布（已创建 Standby Order）；archived=归档（手动或自动）';

-- Order 订单状态机（执行态）
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum (
      'Standby',
      'Pairing',
      'InProgress',
      'Delivered',
      'Accepted',
      'AutoAccepted',
      'RefundRequested',
      'CancelRequested',
      'Disputed',
      'AdminArbitrating',
      'Refunded',
      'Paid',
      'Completed'
    );
  end if;
end$$;

comment on type public.order_status is
'Order 执行状态机（PRD 完整枚举），所有执行流程只看 Order.status；Task.current_status 只是镜像字段';

-- Agent 状态（可由当前 InProgress + 队列推导；这里仍持久化方便查询）
do $$
begin
  if not exists (select 1 from pg_type where typname = 'agent_status') then
    create type public.agent_status as enum ('Idle', 'Busy', 'Queueing');
  end if;
end$$;

comment on type public.agent_status is
'Agent 状态：Idle=无 InProgress 且队列为空；Busy=存在 InProgress；Queueing=Busy 且队列非空（展示用）';

-- QueueItem 状态
do $$
begin
  if not exists (select 1 from pg_type where typname = 'queue_item_status') then
    create type public.queue_item_status as enum ('queued', 'consumed', 'canceled');
  end if;
end$$;

comment on type public.queue_item_status is
'队列项状态：queued=排队中；consumed=已消费（创建 Pairing）；canceled=取消/失效';

-- WalletBinding 角色（这里按 PRD：A/B）
do $$
begin
  if not exists (select 1 from pg_type where typname = 'wallet_role') then
    create type public.wallet_role as enum ('A', 'B');
  end if;
end$$;

comment on type public.wallet_role is
'钱包绑定角色：A=发布者；B=Agent 提供者（收款地址绑定主要用于 B）';

-- Dispute 状态
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dispute_status') then
    create type public.dispute_status as enum ('open', 'under_review', 'resolved');
  end if;
end$$;

comment on type public.dispute_status is
'争议状态：open=已发起平台介入；under_review=管理员处理中；resolved=已裁决';

-- Dispute 裁决结果
do $$
begin
  if not exists (select 1 from pg_type where typname = 'dispute_resolution') then
    create type public.dispute_resolution as enum ('refund_to_A', 'pay_to_B', 'other');
  end if;
end$$;

comment on type public.dispute_resolution is
'争议裁决结果：refund_to_A=强制退款；pay_to_B=强制付款；other=保留扩展';

-- Review 评价对象类型
do $$
begin
  if not exists (select 1 from pg_type where typname = 'review_target_type') then
    create type public.review_target_type as enum ('agent', 'user');
  end if;
end$$;

comment on type public.review_target_type is
'评价对象类型：agent=评价 Agent；user=评价用户（如 B 评价 A）';

-- Task 类型（可按你们前端枚举扩展）
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_type') then
    create type public.task_type as enum (
      'writing',
      'translation',
      'code',
      'website',
      'email_automation',
      'info_collection',
      'other_mastra'
    );
  end if;
end$$;

comment on type public.task_type is
'任务类型枚举（PRD 给的 type enum），用于匹配与筛选';

-- ============================================================
-- 2) 用户扩展资料（可选，但推荐）
-- ============================================================

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_profiles is
'用户扩展资料：与 Supabase auth.users 1:1；存展示昵称、头像等（非必须，但实际业务常用）';

comment on column public.user_profiles.user_id is '引用 auth.users.id';
comment on column public.user_profiles.display_name is '展示昵称（前端展示用）';
comment on column public.user_profiles.avatar_url is '头像 URL（可为空）';
comment on column public.user_profiles.created_at is '创建时间';
comment on column public.user_profiles.updated_at is '更新时间（触发器自动维护）';

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- ============================================================
-- 3) 文件/附件（统一管理上传元数据）
-- ============================================================

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references auth.users(id) on delete restrict,
  bucket text not null,
  object_path text not null,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.files is
'上传文件元数据（附件）：实际文件建议放 Supabase Storage；此表用于引用与审计。PRD 强提示：S3/公开存储，请勿上传隐私。';

comment on column public.files.id is '文件 ID（业务引用）';
comment on column public.files.uploader_id is '上传者 user_id（auth.users）';
comment on column public.files.bucket is 'Storage bucket 名称（如 "public-uploads"）';
comment on column public.files.object_path is '对象路径（bucket 内路径）';
comment on column public.files.mime_type is 'MIME 类型（可为空）';
comment on column public.files.size_bytes is '文件大小（字节，可为空）';
comment on column public.files.sha256 is '内容哈希（可选，用于去重/审计）';
comment on column public.files.is_public is '是否公开可访问（MVP 按 PRD 默认 true）';
comment on column public.files.created_at is '上传记录创建时间';

create unique index if not exists idx_files_bucket_path
on public.files(bucket, object_path);

comment on index public.idx_files_bucket_path is
'防止同 bucket/path 重复记录（按需）';

-- ============================================================
-- 4) Agent
-- ============================================================

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,

  name text not null,
  description text not null,
  avatar_url text,
  mastra_url text not null,

  tags text[] not null default '{}'::text[],
  supported_task_types public.task_type[] not null default '{}'::public.task_type[],

  min_price numeric(78,0) not null default 0,
  max_price numeric(78,0) not null default 0,

  avg_rating double precision not null default 0,
  rating_count integer not null default 0,
  completed_order_count integer not null default 0,

  status public.agent_status not null default 'Idle',
  current_order_id uuid, -- 进行中订单（可为空）
  queue_size integer not null default 0, -- 冗余：便于筛选（实际以 queue_items 查询校准）

  is_listed boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agents is
'Agent（B 发布）：包含 Mastra URL、标签、支持类型、报价范围、评分统计与状态（Idle/Busy/Queueing）。';

comment on column public.agents.id is 'Agent ID';
comment on column public.agents.owner_id is 'Agent 所属 B 用户（auth.users）';
comment on column public.agents.name is 'Agent 名称';
comment on column public.agents.description is 'Agent 描述';
comment on column public.agents.avatar_url is '头像 URL（可为空）';
comment on column public.agents.mastra_url is 'Mastra Cloud 的 Agent URL（外部执行入口）';

comment on column public.agents.tags is '标签数组（用于匹配与筛选）';
comment on column public.agents.supported_task_types is '支持的任务类型数组';

comment on column public.agents.min_price is '最低报价（MockUSDT 最小单位整数）';
comment on column public.agents.max_price is '最高报价（MockUSDT 最小单位整数）';

comment on column public.agents.avg_rating is '平均评分（冗余统计）';
comment on column public.agents.rating_count is '评分人数（冗余统计）';
comment on column public.agents.completed_order_count is '完成订单数（冗余统计）';

comment on column public.agents.status is 'Agent 状态（Idle/Busy/Queueing）';
comment on column public.agents.current_order_id is '当前进行中订单 ID（可为空）';
comment on column public.agents.queue_size is '队列长度冗余字段（队列按 queue_items 动态/异步维护）';

comment on column public.agents.is_listed is '是否上架（管理员可下架/隐藏）';
comment on column public.agents.created_at is '创建时间';
comment on column public.agents.updated_at is '更新时间（触发器自动维护）';

alter table public.agents
  add constraint chk_agents_price_range
  check (min_price >= 0 and max_price >= 0 and max_price >= min_price);

create index if not exists idx_agents_owner on public.agents(owner_id);
create index if not exists idx_agents_status on public.agents(status);
create index if not exists idx_agents_listed on public.agents(is_listed);

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
before update on public.agents
for each row execute function public.set_updated_at();

-- ============================================================
-- 5) WalletBinding（钱包绑定：B 收款地址 active）
-- ============================================================

create table if not exists public.wallet_bindings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.wallet_role not null default 'B',

  address text not null, -- EVM 地址（0x...）
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

comment on table public.wallet_bindings is
'钱包绑定表：用于记录用户的钱包地址绑定/更换。PRD 约束：同一 user + role 只允许一条 is_active=true。';

comment on column public.wallet_bindings.id is '绑定记录 ID';
comment on column public.wallet_bindings.user_id is '用户 ID（auth.users）';
comment on column public.wallet_bindings.role is '角色：A/B（B 为收款绑定主用）';
comment on column public.wallet_bindings.address is 'EVM 地址（0x...）';
comment on column public.wallet_bindings.is_active is '是否当前生效地址（同一 user+role 只能有一条 true）';
comment on column public.wallet_bindings.created_at is '创建时间';
comment on column public.wallet_bindings.deactivated_at is '失效时间（切换地址时写入）';

-- 同一 user + role 只能有一个 active
create unique index if not exists uq_wallet_bindings_user_role_active
on public.wallet_bindings(user_id, role)
where is_active;

create index if not exists idx_wallet_bindings_user on public.wallet_bindings(user_id);

-- ============================================================
-- 6) Task
-- ============================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete restrict,

  title text not null,
  description text not null,
  type public.task_type not null,
  tags text[] not null default '{}'::text[],

  expected_reward numeric(78,0) not null default 0, -- MockUSDT 最小单位整数

  status public.task_status not null default 'unpaid',

  current_order_id uuid, -- published 后绑定当前订单
  current_status public.order_status, -- 镜像当前订单状态（列表筛选用）

  last_pay_tx_hash text, -- 可选：记录最近一次支付尝试 tx
  pay_fail_reason text,  -- 可选：支付失败原因（链下写）

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tasks is
'任务表（A 发布）：Task.status 只表达平台层生命周期（unpaid/published/archived）。执行态由 Order.status 表达。';

comment on column public.tasks.id is 'Task ID';
comment on column public.tasks.creator_id is '发布者 A（auth.users）';
comment on column public.tasks.title is '任务标题';
comment on column public.tasks.description is '任务描述';
comment on column public.tasks.type is '任务类型（enum）';
comment on column public.tasks.tags is '任务标签数组';
comment on column public.tasks.expected_reward is '预期奖励金额（MockUSDT 最小单位整数）';

comment on column public.tasks.status is '任务平台层状态：unpaid/published/archived';
comment on column public.tasks.current_order_id is '当前订单 ID（published 后通常不为空）';
comment on column public.tasks.current_status is '镜像当前 Order.status（用于列表筛选，不作为真实状态源）';

comment on column public.tasks.last_pay_tx_hash is '最近一次支付交易哈希（可为空）';
comment on column public.tasks.pay_fail_reason is '支付失败原因（可为空，由后端写入）';

comment on column public.tasks.created_at is '创建时间';
comment on column public.tasks.updated_at is '更新时间（触发器自动维护）';

alter table public.tasks
  add constraint chk_tasks_expected_reward_nonneg
  check (expected_reward >= 0);

create index if not exists idx_tasks_creator on public.tasks(creator_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_current_status on public.tasks(current_status);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- Task 附件关联（多对多/一对多）
create table if not exists public.task_attachments (
  task_id uuid not null references public.tasks(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (task_id, file_id)
);

comment on table public.task_attachments is
'任务附件关联表：替代 tasks.attachments[]，便于查询与权限控制。';

comment on column public.task_attachments.task_id is '任务 ID';
comment on column public.task_attachments.file_id is '文件 ID';
comment on column public.task_attachments.created_at is '关联创建时间';

-- ============================================================
-- 7) Order
-- ============================================================

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,

  creator_id uuid not null references auth.users(id) on delete restrict, -- A
  provider_id uuid references auth.users(id) on delete restrict,         -- B（Pairing 成功后才有）
  agent_id uuid references public.agents(id) on delete restrict,         -- 选定 Agent（Pairing 后通常确定）

  status public.order_status not null default 'Standby',

  reward_amount numeric(78,0) not null default 0,
  platform_fee_rate numeric(10,6) not null default 0.15,
  platform_fee_amount numeric(78,0), -- 可在 payout 时写入（或存储计算结果）

  pay_tx_hash text, -- A -> escrow 的 tx hash（链下校验用）
  escrow_amount numeric(78,0), -- 实际托管金额（来自 Transfer amount）
  payout_tx_hash text, -- escrow -> B/feeReceiver 的 tx hash
  refund_tx_hash text, -- escrow -> A 的 tx hash

  delivered_at timestamptz,
  accepted_at timestamptz,
  auto_accepted_at timestamptz,
  refunded_at timestamptz,
  paid_at timestamptz,
  completed_at timestamptz,

  refund_request_reason text,
  cancel_request_reason text,

  dispute_id uuid, -- 关联 disputes.id（nullable）
  pairing_created_at timestamptz, -- Pairing 创建时间（用于 TTL）

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.orders is
'订单表：执行态核心。支付确认后创建 Standby。结算/退款写入 tx_hash 与时间戳，链下状态机驱动。';

comment on column public.orders.id is 'Order ID';
comment on column public.orders.task_id is '所属 Task ID';
comment on column public.orders.creator_id is '发布者 A（auth.users）';
comment on column public.orders.provider_id is '提供者 B（auth.users，可空直到 Pairing 成功）';
comment on column public.orders.agent_id is '选定 Agent（可空直到 Pairing/接单确定）';

comment on column public.orders.status is '订单状态机（Order.status enum）';

comment on column public.orders.reward_amount is '订单奖励总额（MockUSDT 最小单位整数，通常=tasks.expected_reward）';
comment on column public.orders.platform_fee_rate is '平台手续费率（默认 0.15）';
comment on column public.orders.platform_fee_amount is '平台手续费金额（建议在结算时写入，便于对账）';

comment on column public.orders.pay_tx_hash is '支付入金 tx hash（A->escrow transfer 所在交易）';
comment on column public.orders.escrow_amount is '托管金额（从 Transfer 解析的 amount，作为对账源）';
comment on column public.orders.payout_tx_hash is '结算出金 tx hash（escrow->B & feeReceiver）';
comment on column public.orders.refund_tx_hash is '退款 tx hash（escrow->A）';

comment on column public.orders.delivered_at is '交付时间（InProgress->Delivered）';
comment on column public.orders.accepted_at is 'A 手动验收时间（Delivered->Accepted）';
comment on column public.orders.auto_accepted_at is '自动验收触发时间（Delivered->AutoAccepted）';
comment on column public.orders.refunded_at is '退款完成时间';
comment on column public.orders.paid_at is '付款完成时间';
comment on column public.orders.completed_at is '订单完成时间（最终态写入）';

comment on column public.orders.refund_request_reason is 'A 在 Delivered 发起退款填写的原因（可空但建议前端输入）';
comment on column public.orders.cancel_request_reason is 'B 在 InProgress 发起中断填写的原因（可空但建议前端输入）';

comment on column public.orders.dispute_id is '争议 ID（disputes.id，可空）';
comment on column public.orders.pairing_created_at is 'Pairing 创建时间（用于 TTL 计算）';

comment on column public.orders.created_at is '创建时间';
comment on column public.orders.updated_at is '更新时间（触发器自动维护）';

alter table public.orders
  add constraint chk_orders_amounts_nonneg
  check (
    reward_amount >= 0 and
    (platform_fee_rate >= 0 and platform_fee_rate <= 1) and
    (platform_fee_amount is null or platform_fee_amount >= 0) and
    (escrow_amount is null or escrow_amount >= 0)
  );

-- 常用索引
create index if not exists idx_orders_task on public.orders(task_id);
create index if not exists idx_orders_creator on public.orders(creator_id);
create index if not exists idx_orders_provider on public.orders(provider_id);
create index if not exists idx_orders_agent on public.orders(agent_id);
create index if not exists idx_orders_status on public.orders(status);

-- tx_hash 一般需要查重/对账（可选 unique；若你们允许多次支付尝试则不要 unique）
create index if not exists idx_orders_pay_tx_hash on public.orders(pay_tx_hash);
create index if not exists idx_orders_payout_tx_hash on public.orders(payout_tx_hash);
create index if not exists idx_orders_refund_tx_hash on public.orders(refund_tx_hash);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- ============================================================
-- 8) Delivery（交付记录）
-- ============================================================

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete restrict,

  content_text text,
  external_url text,

  submitted_at timestamptz not null default now()

  -- ⚠️ 注意：至少一项内容非空（contentText/externalUrl/attachments）的校验在应用层进行
  -- 原因：
  --   1. DB 无法直接检查 delivery_attachments 关联表，强制 CHECK 会禁止"仅附件交付"场景
  --   2. 空白字符串（如 '  '）的校验也应在应用层通过 trim() 统一处理
  --   3. 应用层应确保：btrim(content_text) <> '' OR external_url IS NOT NULL OR 存在附件
);

comment on table public.deliveries is
'交付表：B 提交交付（contentText/externalUrl/attachments 至少一项非空，在应用层校验）。附件用 delivery_attachments 关联。';

comment on column public.deliveries.id is 'Delivery ID';
comment on column public.deliveries.order_id is '所属 Order ID';
comment on column public.deliveries.provider_id is '提交者 B（auth.users）';
comment on column public.deliveries.content_text is '交付文本内容（可空）';
comment on column public.deliveries.external_url is '交付外链（可空）';
comment on column public.deliveries.submitted_at is '提交时间（Delivered 的 deliveredAt 由 orders.delivered_at 记录）';

create index if not exists idx_deliveries_order on public.deliveries(order_id);

-- Delivery 附件关联
create table if not exists public.delivery_attachments (
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  file_id uuid not null references public.files(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (delivery_id, file_id)
);

comment on table public.delivery_attachments is
'交付附件关联表：支持一个 Delivery 多个文件。';

comment on column public.delivery_attachments.delivery_id is '交付 ID';
comment on column public.delivery_attachments.file_id is '文件 ID';
comment on column public.delivery_attachments.created_at is '关联创建时间';

-- ============================================================
-- 9) QueueItem（排队）
-- ============================================================

create table if not exists public.queue_items (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,

  status public.queue_item_status not null default 'queued',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  canceled_at timestamptz
);

comment on table public.queue_items is
'队列项：命中 Busy Agent 时创建。顺序按 created_at FIFO；不存 position。';

comment on column public.queue_items.id is 'QueueItem ID';
comment on column public.queue_items.agent_id is '所属 Agent';
comment on column public.queue_items.task_id is '所属 Task（冗余便于查询）';
comment on column public.queue_items.order_id is '所属 Order（同一个 agent+order 只允许一个 queued）';
comment on column public.queue_items.status is '队列项状态：queued/consumed/canceled';
comment on column public.queue_items.created_at is '入队时间（FIFO 排序依据）';
comment on column public.queue_items.consumed_at is '消费时间（consume-next 原子更新时写入）';
comment on column public.queue_items.canceled_at is '取消时间（取消排队时写入，可选）';

create index if not exists idx_queue_items_agent_created_at
on public.queue_items(agent_id, created_at);

create index if not exists idx_queue_items_order
on public.queue_items(order_id);

create index if not exists idx_queue_items_consumed_at
on public.queue_items(consumed_at);

create index if not exists idx_queue_items_canceled_at
on public.queue_items(canceled_at);

-- 去重：同一 (agent_id, order_id) 同时最多存在一条 queued
create unique index if not exists uq_queue_items_agent_order_queued
on public.queue_items(agent_id, order_id)
where status = 'queued';

comment on index public.uq_queue_items_agent_order_queued is
'硬约束：同一 agent+order 同时最多一条 queued，避免重复排队';

-- ============================================================
-- 10) Dispute（平台介入/仲裁）
-- ============================================================

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  initiator_id uuid not null references auth.users(id) on delete restrict,

  reason text not null, -- 平台介入时额外说明
  status public.dispute_status not null default 'open',

  admin_id uuid references auth.users(id) on delete set null, -- 管理员账号（也可独立管理员表）
  resolution public.dispute_resolution,
  resolution_note text,
  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.disputes is
'争议表：一旦进入平台介入，创建 Dispute；管理员在 under_review/resolved 下处理。';

comment on column public.disputes.id is 'Dispute ID';
comment on column public.disputes.order_id is '关联订单';
comment on column public.disputes.initiator_id is '发起平台介入的一方（A 或 B）';
comment on column public.disputes.reason is '平台介入时填写的说明（与 refund/cancel 的 requestReason 区分）';
comment on column public.disputes.status is '争议状态：open/under_review/resolved';
comment on column public.disputes.admin_id is '处理该争议的管理员 user_id（可空）';
comment on column public.disputes.resolution is '裁决结果：refund_to_A/pay_to_B/other';
comment on column public.disputes.resolution_note is '裁决备注（可空）';
comment on column public.disputes.resolved_at is '裁决完成时间（可空）';
comment on column public.disputes.created_at is '创建时间';
comment on column public.disputes.updated_at is '更新时间（触发器自动维护）';

-- 一个订单通常只允许一个 dispute（MVP 简化）
create unique index if not exists uq_disputes_order
on public.disputes(order_id);

drop trigger if exists trg_disputes_updated_at on public.disputes;
create trigger trg_disputes_updated_at
before update on public.disputes
for each row execute function public.set_updated_at();

-- ============================================================
-- 11) Review（评价）
-- ============================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,

  from_user_id uuid not null references auth.users(id) on delete restrict,
  to_user_id uuid not null references auth.users(id) on delete restrict,

  target_type public.review_target_type not null,
  rating integer not null,
  comment text,

  created_at timestamptz not null default now()
);

comment on table public.reviews is
'评价表：订单完成后互评。target_type=agent 时通常是 A->B 的 Agent；target_type=user 时是对用户的评价。';

comment on column public.reviews.id is 'Review ID';
comment on column public.reviews.order_id is '关联订单';
comment on column public.reviews.from_user_id is '评价发起人';
comment on column public.reviews.to_user_id is '评价对象（用户）';
comment on column public.reviews.target_type is '评价对象类型：agent/user';
comment on column public.reviews.rating is '评分（1-5）';
comment on column public.reviews.comment is '文字评价（可空）';
comment on column public.reviews.created_at is '创建时间';

alter table public.reviews
  add constraint chk_reviews_rating
  check (rating between 1 and 5);

create index if not exists idx_reviews_order on public.reviews(order_id);
create index if not exists idx_reviews_to_user on public.reviews(to_user_id);

-- 可选：同一订单同一 from->to 同一 target_type 只允许一条
create unique index if not exists uq_reviews_unique_per_pair
on public.reviews(order_id, from_user_id, to_user_id, target_type);

-- ============================================================
-- 12) 绑定关系/一致性（可选约束）
-- ============================================================

-- Task.current_order_id -> orders.id（可选外键，允许为空）
-- 注意：要避免循环依赖（orders.task_id -> tasks.id），这里用 deferrable 会更稳
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'fk_tasks_current_order'
      and table_name = 'tasks'
  ) then
    alter table public.tasks
      add constraint fk_tasks_current_order
      foreign key (current_order_id)
      references public.orders(id)
      deferrable initially deferred;
  end if;
end$$;

comment on constraint fk_tasks_current_order on public.tasks is
'可选外键：Task.current_order_id 指向 orders.id（deferrable 以避免插入顺序问题）';

-- orders.dispute_id -> disputes.id（可选外键）
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_name = 'fk_orders_dispute'
      and table_name = 'orders'
  ) then
    alter table public.orders
      add constraint fk_orders_dispute
      foreign key (dispute_id)
      references public.disputes(id)
      deferrable initially deferred;
  end if;
end$$;

comment on constraint fk_orders_dispute on public.orders is
'可选外键：Order.dispute_id 指向 disputes.id（deferrable）';

-- ============================================================
-- 13) 视图（可选）：队列序号 n 动态计算示例（按 created_at FIFO）
-- ============================================================

create or replace view public.v_queue_items_with_position as
select
  qi.*,
  row_number() over (partition by qi.agent_id order by qi.created_at asc) as display_position
from public.queue_items qi
where qi.status = 'queued';

comment on view public.v_queue_items_with_position is
'队列序号展示视图：display_position 为动态计算，不持久化；仅对 status=queued 的队列项';

-- ============================================================
-- End of Schema
-- ============================================================