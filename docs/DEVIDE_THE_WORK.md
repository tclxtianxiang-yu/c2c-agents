# 模块化分

模块 A：Platform Core（唯一收口点）【Owner #1】
• 定义并维护全局数据模型与约束：Task / Order / Agent / QueueItem / Delivery / Dispute / WalletBinding 的 schema、索引、唯一约束、外键关系（唯一收口）。
• 定义并维护订单状态机：OrderStatus 全量枚举、允许/禁止迁移矩阵（其他模块必须按此执行）。
• 定义并维护全局幂等与并发策略：payTxHash / payoutTxHash / refundTxHash 幂等字段策略、队列消费/状态迁移的原子约束原则。
• 提供全局共享类型与错误码：DTO/types、错误码、统一校验规则（供前后端复用）。
• 提供链上统一网关：支付确认校验、recordEscrow、payout、refund 的统一调用封装（其他模块只调用网关）。
• 提供后端共享中间件：requestId、auth、错误映射等全局 core 能力（仅核心层）。

⸻

模块 B：A 端发布 + 支付确认（unpaid→published & 创建 Standby Order）【Owner #2】
• A 端任务发布：创建任务基础信息，生成待支付的任务记录（unpaid）。
• 链上支付确认流程：接收 payTxHash，完成“交易成功/确认数/Transfer 四元组”校验。
• 发布闭环：支付确认成功后，将 Task 从 unpaid → published，并创建对应 Standby Order。
• 关键要求：支付确认成功且 Order 创建成功后必须调用 recordEscrow，失败需阻断后续流转。
• 支付相关幂等：重复提交 txHash、重复确认、错误 txHash 等情况下不重复创建订单、不产生状态错乱。
• 提供任务读取视图：能让前端获取任务与支付确认状态（用于轮询/刷新展示）。

⸻

模块 C：匹配 + Pairing（Standby↔Pairing↔InProgress）【Owner #3】
• 撮合入口与流程编排：对 Standby 订单执行自动匹配/手动选择，驱动进入 Pairing 或进入队列。
• Pairing 生命周期管理：创建 Pairing、同意/拒绝、TTL 到期过期处理、拒绝后回滚到 Standby。
• 并发一致性：处理双方同时 accept、重复 accept、拒绝与过期竞态等，确保最终状态唯一正确。
• 任务详情页容器 Owner：统一在详情页按状态组织展示（只是“编排与容器”，具体子组件由其他模块提供）。
• 与队列解耦：不直接改队列表，只调用模块 D 提供的 QueueService/接口完成 enqueue/cancel/consume 相关动作。

⸻

模块 D：Agent 管理 + 队列（QueueItem FIFO + N 上限 + 去重）【Owner #4】
• Agent 资产管理：Agent 的创建/编辑/查询（面向 B），以及市场检索/筛选展示（面向 A）。
• 队列核心能力：QueueItem 的 enqueue / cancel / consume-next（FIFO）。
• 队列 P0 约束落地：去重（queued 唯一）、队列上限 N、consume-next 原子性（并发只允许一个成功）。
• 对外服务抽象：向模块 C 暴露可调用的 QueueService（C 不触碰队列表）。
• 队列相关 UI 输出：Agent 市场/详情页、B 工作台队列 Tab 的子组件（容器不归你）。

⸻

模块 E：交付 + 验收 + AutoAccepted + 正常结算（Delivered→Paid→Completed）【Owner #5】
• B 工作台容器 Owner：B 侧执行流的主要操作入口与状态展示组织。
• 交付流程：InProgress 状态下提交交付内容，驱动订单进入 Delivered，并提供交付内容可视化。
• 验收与正常结算：A 人工验收触发 payout，推动 Paid→Completed（通过 Core 链上网关）。
• 自动验收：Delivered 超时自动验收（cron），并保证幂等（不重复打款）。
• 互斥规则执行：若订单进入 RefundRequested/CancelRequested/Disputed 等争议分支，自动验收必须跳过。
• 可复用子组件输出：为任务详情页提供 Delivered/验收展示的子组件（容器仍归模块 C）。

⸻

模块 F：退款/中断/争议/管理员仲裁（Refund/Cancel/Dispute）【Owner #6】
• 协商式退款/中断流程：发起 refund-request / cancel-request、展示理由、对方同意/拒绝的处理。
• 争议升级机制：在满足前置条件（例如“被拒绝后”）时进入 dispute，驱动订单进入平台介入/仲裁态。
• 争议撤回：可撤回并回到原执行态（退款争议撤回→Delivered，中断争议撤回→InProgress）。
• 管理员仲裁能力：管理员后台对 AdminArbitrating 订单执行强制退款或强制付款（强制付款需满足 Delivered + Delivery 前置）。
• 链上退款/强制付款幂等：refundTxHash / payoutTxHash 保证重复操作不重复链上执行。
• 前端输出：任务详情相关的退款/争议操作面板（子组件）+ 简版管理员后台页面。

⸻
