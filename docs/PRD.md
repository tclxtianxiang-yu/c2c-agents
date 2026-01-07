# C2C Agents PRD

## 产品目标（MVP）

本产品是一个 C2C Web3 任务接单平台，任务由外部 Mastra Cloud 上的 AI Agent 执行。平台负责任务与 Agent 的展示和撮合、订单状态流转、争议处理入口，以及基于 Sepolia + MockUSDT 的链上托管支付与结算，不直接运行 Agent。

目标：

- 在 Sepolia 上用 MockUSDT 实现从 A 托管、成交结算到 B 的完整资金闭环。
- 支持发布者 A 发布任务、Agent 提供者 B 发布 Agent，支持自动匹配与手动选择形成订单。
- 实现完整订单生命周期：任务发布、匹配、执行、交付、验收（含 24h 自动验收）、退款/中断/争议与管理员仲裁。
- 提供基础评分与简单排序、排队与 Busy 状态，为后续智能匹配升级提供基础。

## 非目标（MVP 不做）

- 不做 KYC/AML、复杂风控、内容合规审核，仅提供人工仲裁入口。
- 不做多链和多币种，固定为 Sepolia + MockUSDT。
- 不做复杂推荐算法、Agent 性能监控，只做简单评分+标签排序。
- 不做多方结算、税务、收据等复杂财务能力。
- 不对 Mastra Cloud Agent 的权限、安全做系统治理，仅通过提示文案警示。

---

# 2. 角色与权限（A/B/管理员）

## 发布者 A

- 注册/登录。
- 连接 Sepolia 钱包。
- 创建 Task：填写任务内容、上传附件、设置 reward（MockUSDT）。
- 完成链上支付并通过后端校验后自动创建 Order，进入 Standby。
- 通过自动匹配或手动选择 Agent 触发 Pairing 或队列。
- 在「我的任务」中查看 Task/Order 详情并操作；可只读浏览「任务广场」。
- 在 Pairing 中「同意/拒绝」拟成单。
- 在 Delivered 状态下验收或发起退款。
- 在 RefundRequested / CancelRequested 状态下同意或拒绝。
- 发起平台介入，进入争议。
- 在订单完成后对 Agent 评分并评价。
- 在账户中心查看任务和支付记录。

## Agent 提供者 B

- 注册/登录。
- 连接并通过签名绑定/更换钱包收款地址。
- 创建/编辑 Agent：名称、描述、Mastra URL、tags、支持任务类型、报价范围。
- 浏览任务广场（只读），不能主动抢单，只能处理系统下发的 Pairing。
- 在工作台查看拟成单（Pairing）、进行中订单、已交付待结果、队列。
- 对 Pairing 同意/拒绝。
- 在 InProgress 状态下执行任务并提交交付。
- 在 InProgress 状态下发起中断（CancelRequested）。
- 在退款/中断请求下同意或拒绝，并可发起平台介入。
- 在订单完成后可选评价 A。
- 在账户中心查看接单订单与收款记录。

## 管理员

- 登录后台。
- 浏览所有订单、争议信息。
- 查看 AdminArbitrating 订单详情：任务、交付、沟通记录、退款/中断原因。
- 对争议订单执行强制退款或强制付款。
- 查看基础运营统计（订单数、争议数、手续费总额等，可选）。
- 对 Agent 做简单管理（如隐藏/下架，字段级支持）。

---

# 3. 核心用户旅程（A & B）

## 发布者 A 旅程

1. 登录后进入首页「我的任务」，点击「发布任务」。
2. 填写标题、类型（写作/翻译/代码/网站/邮件自动化/信息收集/其他 Mastra）、描述、tags、附件，输入 reward（单位 MockUSDT）。
3. 提交表单后，后端创建 Task：
   - Task.status = `unpaid`；
   - 生成 `taskId` 并返回前端。
4. 前端基于 `taskId` 调起钱包，将 MockUSDT 转入 escrow 合约：
   - 使用配置的 MockUSDT 合约地址和 escrow 合约地址；
   - 获取 payTxHash 并回传后端。
5. 后端监听/轮询链上，对 `payTxHash` 做校验：
   - 交易回执 receipt.status = 1；
   - 区块确认数 ≥ minConfirmations（配置项，MVP 可设为 1）；
   - 解析 ERC20 Transfer 事件，四元组满足：
     - token = MockUSDT；
     - from = 当前 A 钱包地址；
     - to = escrow 合约地址；
     - amount = Task.expectedReward。
6. 校验全部通过：
   - 创建 Order 记录：
     - 绑定 taskId、creatorId、rewardAmount；
     - 写入 payTxHash、escrowAmount（=amount）；
     - Order.status = Standby；
   - 关键步骤：支付确认成功且 Order 创建成功后必须调用 recordEscrow，失败需阻断后续状态流转；
   - 更新 Task：
     - Task.status = `published`；
     - Task.currentOrderId = Order.id；
     - Task.currentStatus = Standby。
7. 校验不通过或未达确认数：

   - 不创建 Order，Task.status 保持 `unpaid`；
   - 可记录 lastPayTxHash 和失败原因；
   - 前端展示「支付确认中/失败，请稍后刷新或重试」。

8. 在任务详情中，当存在 Standby 的 Order 时，A 可：

   - 点击「自动匹配」；
   - 点击「手动选择 Agent」。

9. 自动匹配：

   - 后端筛选候选 Agent：
     - 支持任务类型；
     - reward 在 minPrice~maxPrice 范围内；
     - 队列长度 < N（队列上限配置项）；
     - Agent 状态为 Idle 或 Busy。
   - 对候选按排序规则排序（见第 8 节），选择 Top1：
     - 若 Agent Idle：
       - 创建 Pairing，记录 pairingCreatedAt；
       - Order.status = Pairing。
     - 若 Agent Busy 且队列未满：
       - 检查该 agentId+orderId 是否已存在 status 为 queued 的 QueueItem，若已存在则不重复创建；
       - 若无，则创建 QueueItem（status = queued）；
       - Order.status 仍为 Standby。
   - 前端行为（命中 Busy）：
     - 弹出提示「已加入 Agent X 队列，当前排队序号 n」；
     - 在任务详情展示队列卡片（Agent 名称、序号 n、取消排队按钮）；
     - 将「自动匹配」按钮状态改为「已排队」或替换为「取消排队」。

10. 手动选择：

    - 从任务详情跳转到 Agent 市场，自动带入任务 tags 搜索；
    - A 选择某 Agent 时：
      - 若 reward 不在 minPrice~maxPrice 或队列已满：
        - 「选择此 Agent」按钮置灰并提示「报价不匹配 / 队列已满」；
      - 否则：
        - Idle → 创建 Pairing，与自动匹配 Idle 流程相同；
        - Busy → 创建 QueueItem，与自动匹配 Busy 流程相同。

11. Pairing 阶段：

    - 创建 Pairing 时记录 pairingCreatedAt；
    - 定义 Pairing TTL（例如 24 小时，配置项）；
    - A、B 两侧均可在 Pairing 中看到对方信息，并拥有「同意」「拒绝」按钮。
    - 状态流转：
      - A 与 B 均点击「同意」：
        - Order.status → InProgress；
        - Agent.status → Busy；
      - A 或 B 任一方点击「拒绝」：
        - 当前 Pairing 标记为 canceled；
        - Order.status → Standby；
        - 若来源为 QueueItem，则对应 QueueItem.status = canceled；
      - 若在 pairingCreatedAt + TTL 内双方都未做决定，且 Pairing 仍未结束：
        - 系统自动将 Pairing 标记为 expired（视同拒绝）；
        - Order.status → Standby；
        - QueueItem 如有则 status = canceled。

12. InProgress：

    - 订单进入执行阶段，由 B 在 Mastra Cloud 外部执行；
    - A 在任务详情看到「执行中，由 Agent X 处理」；
    - B 在工作台看到 InProgress 订单，可：
      - 记录执行备注（可选）；
      - 点击「提交交付」；
      - 点击「发起中断」。

13. 提交交付（Delivery）：

    - B 在 InProgress 状态下点击「提交交付」，填写：
      - 文本内容 contentText（可为空）；
      - externalUrl（可为空）；
      - 附件列表 attachments（可为空）。
    - 校验规则：
      - contentText 非空，或 externalUrl 非空，或 attachments 非空（三者至少一项非空）。
      - 不满足则阻止提交并提示「请至少填写文本、链接或上传一个附件」。
    - 校验通过后：
      - 创建 Delivery 记录；
      - Order.status：InProgress → Delivered；
      - 写入 deliveredAt = 当前时间。

14. Delivered 与 24h 验收计时：

    - 进入 Delivered 时，开始 24h 倒计时，deadline = deliveredAt + 24h。
    - A 可在订单详情中看到交付内容和剩余时间。
    - 在 Delivered 状态下（且尚未进入任何退款/争议状态），A 可：
      - 点击「验收通过」：
        - Order.status → Accepted；
        - 后端调用 escrow 合约结算 rewardAmount \* (1 – 15%) 给 B 当前 active 地址（前置条件：recordEscrow 已成功）；
        - 成功后 Order.status → Paid → Completed，记录 acceptedAt、paidAt、completedAt；
      - 点击「发起退款」：
        - 填写 refundRequestReason；
        - Order.status → RefundRequested；
        - AutoAccepted 分支永久关闭；
      - 不操作：
        - 若始终保持 Delivered 且未出现 RefundRequested/CancelRequested/Disputed/AdminArbitrating，则在 deadline 后由后台定时任务触发 AutoAccepted：
          - 再次检查该订单仍为 Delivered 且无退款/争议；
          - Order.status → AutoAccepted；
          - 调用合约付款给 B（扣除 15% 手续费，前置条件：recordEscrow 已成功）；
          - 成功后 Order.status → Paid → Completed，记录 autoAcceptedAt、paidAt、completedAt。

15. B 在 InProgress 中发起中断：

    - B 可在 InProgress 状态下点击「发起中断」，填写 cancelRequestReason；
    - Order.status：InProgress → CancelRequested；
    - A 在 CancelRequested 状态下可：
      - 同意：调用合约退款给 A → Order.status = Refunded → Completed（前置条件：recordEscrow 已成功）；
      - 拒绝：双方任一方可发起平台介入。

16. 退款/中断协商失败与平台介入：

    - RefundRequested / CancelRequested 状态中：
      - 任意一方拒绝对方请求后，可点击「平台介入」；
      - Order.status → Disputed（平台介入但允许继续协商）；
      - 争议可撤回：
        - 退款争议撤回：Disputed → Delivered
        - 中断争议撤回：Disputed → InProgress
      - 管理员介入：Disputed → AdminArbitrating。
    - AdminArbitrating 状态下，管理员在后台看到：
      - Task 信息；
      - Delivery 内容；
      - refundRequestReason、cancelRequestReason；
      - Dispute.reason（发起平台介入时填写）。
    - 管理员可选择：
      - 强制退款给 A：
        - 调用合约退款 rewardAmount 给 A；
        - Order.status = Refunded → Completed；
      - 强制付款给 B：
        - 前提：订单存在 Delivered 且至少一条 Delivery；
        - 调用合约向 B 支付 rewardAmount \* (1 – 15%)；
        - Order.status = Paid → Completed。

17. 订单完成后：
    - A 可对 Agent 做星级评价与文字评价（可选）；
    - B 可对 A 做可选评价；
    - A 在账户中心的任务订单列表中查看所有历史记录，B 在收款记录中查看收入情况。

## Agent 提供者 B 旅程（简述）

- 创建 Agent，绑定钱包；
- 通过自动匹配/手动选择形成 Pairing，完成接单确认；
- 在 InProgress 下执行任务并提交交付；
- 在必要时发起中断并参与退款/争议；
- 在订单完成后收款并参与评价。

（具体过程已在 A 旅程中涵盖双方视角，此处不再重复逐步展开。）

---

# 4. 功能模块拆解（按模块/页面）

## 任务模块

已在用户旅程中详细描述，这里补充关键点：

- Task.status 仅表示任务在平台层级的生命周期（unpaid/published/archived），不表达订单执行状态；
- 所有执行状态由 Order.status 表达，Task.currentStatus 只是 Order.status 的冗余镜像，方便列表筛选。

## Agent 模块

- Agent 状态（Idle/Busy/Queueing）根据当前 InProgress 和队列情况计算；
- 队列只使用 QueueItem.createdAt 做 FIFO，不保存 position 字段；
- 队列上限 N 为配置项，达到 N 后该 Agent 不再被自动匹配，手动选择时按钮置灰。

## 争议模块

- RefundRequested / CancelRequested 记录 requestReason，在前端双方和后台管理员都可见；
- Dispute.reason 用于平台介入时的额外说明，单独存于 Dispute 表。

## 钱包与支付模块

- MockUSDT 作为平台测试币，由 faucet/铸币向用户发放；
- 钱包连接是链上操作前提；
- 支付与 escrow 校验按「payTxHash receipt.status=1 + minConfirmations + ERC20 Transfer 四元组一致」执行；
- 结算和退款由平台后端发起合约调用，gas 成本视为平台成本。

（详细逻辑已在用户旅程和状态机中展开。）

---

# 5. 状态机（Order & Agent）

## Order 状态枚举

- Standby
- Pairing
- InProgress
- Delivered
- Accepted
- AutoAccepted
- RefundRequested
- CancelRequested
- Disputed
- AdminArbitrating
- Refunded
- Paid
- Completed

主要迁移：

- 支付校验成功 → 创建 Order（Standby）。
- Standby → Pairing：自动匹配/手动选择 + 命中 Idle Agent。
- Standby → Standby + QueueItem：匹配 Busy Agent + 队列未满。
- Pairing：
  - 双方同意 → InProgress；
  - 任一方拒绝或 TTL 超时 → Standby（队列来源则 QueueItem.canceled）。
- InProgress：
  - 提交交付 → Delivered（写 deliveredAt）；
  - 发起中断 → CancelRequested。
- Delivered：
  - 验收通过 → Accepted → 结算 → Paid → Completed；
  - 24h 无操作且无争议 → AutoAccepted → 结算 → Paid → Completed；
  - A 发起退款 → RefundRequested。
- RefundRequested / CancelRequested：
  - 对方同意 → Refunded → Completed；
  - 对方拒绝 + 平台介入 → Disputed（可撤回）；
  - 管理员介入 → AdminArbitrating。
- AdminArbitrating：
  - 强制退款 → Refunded → Completed；
  - 强制付款（需 Delivered+Delivery）→ Paid → Completed。

自动验收触发与幂等：

- 后端有定时扫描任务（cron/worker），每 X 分钟执行：
  - 查找 Order.status=Delivered 且 now ≥ deliveredAt+24h，且未进入退款/争议；
  - 对每条订单：
    - 再次校验仍为 Delivered 且无争议；
    - 设置 AutoAccepted → 调用结算合约 → 成功后 Paid → Completed；
- 扫描逻辑需通过检查订单状态和 payoutTxHash 确保幂等，不会对已 Paid/Refunded/Completed 的订单重复打款。

## Agent 状态枚举

- Idle：无 InProgress 且队列为空；
- Busy：存在 InProgress；
- Queueing（展示用）：存在 InProgress 且队列非空（也可通过 queueSize>0 推导）。

状态迁移：

- 初始 → Idle；
- Pairing 成功 → InProgress → Busy；
- Busy 时创建 QueueItem（队列未满）→ Busy/Queueing；
- InProgress 结束（Paid/Refunded/Completed）：
  - 若队列非空 → 从队列中按 createdAt 最早的 QueueItem 取出，创建 Pairing，QueueItem.status = consumed，Agent 在 Busy/Queueing 间流转；
  - 若队列为空 → Agent 状态恢复 Idle。

---

# 6. 关键页面清单与要素

（保持完整列出，保证研发有页面级参考）

## 首页 / 任务列表

- Tab：「我的任务」「任务广场」。
- 「我的任务」：
  - 按 Task 展示，含标题、type、Task.status（unpaid/published/archived）、currentStatus（例如 Standby/InProgress 等）、Agent 名称（如有）、reward、创建时间；
  - 支持按 Task.status 和 currentStatus 过滤。
- 「任务广场」：
  - 展示所有公开任务的基础信息（至少 published 且当前 Order.status=Standby 的任务）；
  - 所有人可见，但 A/B 只有对应自己任务才有操作入口。
- 顶部按钮：「发布任务」。

## 发布任务页

- 字段：title、type、description、tags、附件上传、reward（MockUSDT）。
- 显示当前钱包地址或「连接钱包」按钮。
- 行为：
  - 点击「下一步/去支付」：
    - 校验必填项；
    - 后端创建 Task（unpaid）、返回 taskId；
    - 前端调起钱包按 taskId 支付到 escrow（使用 MockUSDT）。
  - 支付后前端可轮询后端 Task 状态：
    - published → 跳转任务详情；
    - unpaid → 显示「支付确认中/失败」等文案。

## 任务详情页

- 展示：
  - Task 基本信息；
  - Task.status（unpaid/published/archived）、currentStatus；
  - 当前 Order 的详细状态与历史（若有）；
  - Agent 信息（Agent 详情链接，若有）；
  - 附件列表与「请勿上传隐私/敏感信息」提示。
- 功能按钮（按 Order.status 显示/禁用）：
  - unpaid：提示「待支付」，可引导重新支付或取消。
  - Standby：
    - 「自动匹配」；
    - 「手动选择 Agent」；
    - 若在队列中 → 队列卡片 +「取消排队」，自动匹配按钮禁用。
  - Pairing：
    - 展示当前配对 Agent 信息；
    - A 按钮：「同意」「拒绝」；
    - 显示 Pairing 剩余有效时间。
  - InProgress：
    - 展示「执行中」；
    - A 无主要操作。
  - Delivered：
    - 展示 Delivery 内容；
    - 显示 24h 倒计时；
    - 按钮：A 的「验收通过」「发起退款」。
  - RefundRequested / CancelRequested：
    - 展示 requestReason；
    - 显示对方发起的请求内容；
    - 当前用户有「同意」「拒绝」按钮，以及当被拒绝后「平台介入」按钮。
  - Disputed：
    - 展示平台介入中；
    - 允许继续协商与「撤回争议」。
  - AdminArbitrating：
    - 展示「已进入平台仲裁，等待管理员处理」，无进一步操作。
  - Completed：
    - 展示完成结果、结算信息；
    - 若 A 未评价 Agent，则显示「评价 Agent」按钮。

## Agents 市场页

- 搜索条件：关键词、tags、任务类型、价格区间。
- 列表项：
  - Agent 名称、摘要描述；
  - avgRating、ratingCount、completedOrderCount；
  - 报价范围 minPrice~maxPrice；
  - 状态（Idle/Busy/Queueing）、队列长度、简单预计完成时间。
- 若从任务详情带上下文进入：
  - 对每个 Agent 显示「选择此 Agent」或置灰状态：
    - 置灰规则：reward 不在报价区间、队列满、Task 未 published 等；
    - 鼠标悬停/点击提示具体原因。

## Agent 详情页

- 展示 Agent 的完整信息、评分与评价、完成订单概览。
- 对 A（带任务上下文）：
  - 显示「选择此 Agent」按钮或禁用提示。
- 对 B 自己：
  - 显示「编辑 Agent」「绑定/更换收款地址」等操作。

## B 工作台

- Tab：
  - 拟成单（Pairing）；
  - 进行中（InProgress）；
  - 已交付待结果（Delivered）；
  - 队列；
  - 历史订单。
- 拟成单：
  - 列表项展示任务简要信息和 reward；
  - 按钮：「同意」「拒绝」。
- 进行中：
  - 列出所有 InProgress；
  - 每条有「提交交付」「发起中断」按钮。
- 已交付待结果：
  - 列出 B 已交付但 A 还未验收/退款的订单，仅展示。
- 队列：
  - 按 Agent 展示队列中的任务列表，按 createdAt 排序，动态展示序号。
- 历史订单：
  - 展示 B 作为 Provider 的已完成订单与收款情况。

## 交付提交页/弹窗

- 展示订单基本信息、A 的任务描述；
- 表单项：contentText、externalUrl、附件上传；
- 校验「至少一项非空」，通过后提交 Delivery 并将状态置为 Delivered。

## 账户中心

- 用户信息、钱包连接状态。
- 对 A：
  - 任务订单列表（所有 Task/Order 历史，含支付与结算信息）。
- 对 B：
  - 接单订单列表；
  - 收款记录（金额、时间、订单号）。
- B 的「Agent 管理」入口：
  - Agent 列表、创建/编辑入口；
  - 钱包绑定状态与签名绑定按钮。

## 管理员后台

- 登录页（简单账号密码）。
- 争议订单列表（AdminArbitrating 状态）：
  - 显示 orderId、taskId、A/B 信息、reward、状态、创建时间。
- 详情页：
  - 任务信息、交付内容、时间轴；
  - refundRequestReason、cancelRequestReason、Dispute.reason；
  - 操作按钮：「强制退款给 A」「强制付款给 B」（后者在无 Delivery 时禁用）。

---

# 7. 数据模型（字段级）

## Task

- id
- creatorId (A)
- title
- description
- type (enum: writing, translation, code, website, email_automation, info_collection, other_mastra)
- tags [string]
- attachments [fileId]
- expectedReward (number, MockUSDT)
- status (enum: `unpaid` | `published` | `archived`)
- currentOrderId (nullable)
- currentStatus (mirror of current Order.status，用于列表筛选)
- createdAt
- updatedAt

## Order

- id
- taskId
- creatorId (A)
- providerId (B, nullable 直到 Pairing 成功)
- agentId (nullable 直到 Pairing 选定)
- status (enum: Standby, Pairing, InProgress, Delivered, Accepted, AutoAccepted, RefundRequested, CancelRequested, Disputed, AdminArbitrating, Refunded, Paid, Completed)
- rewardAmount
- platformFeeRate（默认 0.15）
- platformFeeAmount（可在结算时计算并写入）
- payTxHash
- escrowAmount
- payoutTxHash (nullable)
- refundTxHash (nullable)
- deliveredAt (nullable)
- acceptedAt (nullable)
- autoAcceptedAt (nullable)
- refundedAt (nullable)
- paidAt (nullable)
- completedAt (nullable)
- refundRequestReason (nullable)
- cancelRequestReason (nullable)
- pairingCreatedAt (nullable)
- createdAt
- updatedAt

## Agent

- id
- ownerId (B)
- name
- description
- avatarUrl (nullable)
- mastraUrl
- tags [string]
- supportedTaskTypes [enum]
- minPrice
- maxPrice
- avgRating (float)
- ratingCount (int)
- completedOrderCount (int)
- status (Idle | Busy | Queueing)
- currentOrderId (nullable)
- queueSize (冗余 int，方便查询)
- createdAt
- updatedAt

## Delivery

- id
- orderId
- providerId (B)
- contentText (nullable)
- externalUrl (nullable)
- attachments [fileId]
- submittedAt

## Review

- id
- orderId
- fromUserId
- toUserId
- targetType (enum: agent | user)
- rating (1–5)
- comment (nullable)
- createdAt

## Dispute

- id
- orderId
- initiatorId (A 或 B)
- reason (文本，平台介入时的说明)
- status (enum: open | under_review | resolved)
- adminId (nullable)
- resolution (enum: refund_to_A | pay_to_B | other)
- resolutionNote (nullable)
- resolvedAt (nullable)
- createdAt
- updatedAt

## QueueItem

- id
- agentId
- taskId
- orderId
- status (enum: queued | consumed | canceled)
- createdAt

> 队列顺序仅依赖 createdAt FIFO，不持久化 position 字段。队列序号 n 为展示字段，由后端按 createdAt 排序动态计算。

## WalletBinding

- id
- userId
- role (enum: A | B)
- address
- isActive (bool)
- createdAt
- deactivatedAt (nullable)

---

# 8. 异常与边界情况

- Pairing 被拒绝或 TTL 超时：
  - Pairing 标记 canceled/expired；
  - Order.status 回 Standby；
  - 若来源为 QueueItem → QueueItem.status = canceled。
- 自动匹配命中 Busy Agent：
  - 创建或复用 QueueItem（status = queued，按 agentId+orderId 去重）；
  - Order 仍为 Standby；
  - 前端展示「已排队」提示与队列卡片，并提供「取消排队」。
- 取消排队：
  - A 在任务详情点击「取消排队」：
    - 若 QueueItem.status 仍为 queued，则设为 canceled；
    - Order.status 保持 Standby；
    - 自动匹配按钮恢复可点击。
  - 若 QueueItem 已被消费并创建 Pairing，则后端返回「不在队列中」，前端刷新后会看到 Pairing UI，A 可通过「拒绝」退出。
- 24h 自动验收：
  - Delivered 写入 deliveredAt；
  - 后台定时任务按规则触发 AutoAccepted；
  - 一旦进入 RefundRequested / CancelRequested / Disputed / AdminArbitrating 任意状态，自动验收分支永久关闭。
- 队列上限：
  - 当某 Agent 队列长度 ≥ N 时：
    - 自动匹配过滤掉该 Agent；
    - 手动选择页中的「选择此 Agent」按钮置灰并提示「队列已满」。
- MockUSDT 支付失败或金额不符：
  - 订单不创建，Task 保持 unpaid；
  - 前端显示「支付确认中/失败」。
- 管理员强制付款前置条件：
  - 只有在订单已 Delivered 且存在至少一条 Delivery 时才能点击「强制付款」；
  - 否则按钮灰显并提示「无交付记录，无法付款」。
- S3 公读风险：
  - 所有上传附件区域固定展示文案：
    - 「提示：所有上传的文件将公开存储并可被任何人访问。请勿上传隐私数据、敏感信息或受法律保护的内容。」

---

# 9. 埋点与指标（MVP）

事件（可前后端协同埋点）：

- 任务：
  - task_create_start
  - task_create_success（Task.created & 支付流程发起）
  - task_pay_failed
- 匹配：
  - auto_match_click
  - manual_select_click
  - pairing_accept_A / pairing_reject_A
  - pairing_accept_B / pairing_reject_B
- 执行：
  - order_inprogress（Pairing 成功进入 InProgress）
  - delivery_submit
- 验收：
  - accept_click
  - auto_accept
- 退款/争议：
  - refund_request
  - cancel_request
  - refund_accept / refund_reject
  - cancel_accept / cancel_reject
  - dispute_start
  - dispute_resolved（包含 resolution 类型）
- 评价：
  - review_submit（含 rating 值）

指标：

- 任务发布转化率 = task_create_success / task_create_start
- 成交率 = (Paid + AutoAccepted) / 已 published 且创建了 Order 的任务数
- 争议率 = Disputed/AdminArbitrating 订单数 / 成交订单数
- 验收超时率 = AutoAccepted 订单数 / Delivered 总数
- Agent 评分分布：按 Agent 聚合 avgRating、ratingCount、completedOrderCount

---

# 10. MVP 验收标准（按角色）

## A 侧

- 能完成「发布 Task → 支付 → Task.status=published & Order=Standby」；
- 能通过自动匹配/手动选择进入 Pairing，并在双方同意后进入 InProgress；
- 能在 Delivered 阶段验收通过或发起退款，状态与资金一致；
- Delivered 超过 24h 且无争议时，订单能在合理时间内自动 AutoAccepted → Paid → Completed；
- 能取消队列，并确认 Order 仍为 Standby 且不再显示排队。

## B 侧

- 能创建 Agent 并被展示在 Agent 市场中；
- 能看到系统为自己创建的 Pairing，进行同意/拒绝；
- 能在 InProgress 提交 Delivery，使订单进入 Delivered；
- 在 A 验收或 AutoAccepted 后，能在钱包中看到 MockUSDT 收款；
- 能在 InProgress 发起中断，并根据 A 的同意或拒绝进入 Refunded 或争议。

## 管理员

- 能在后台看到所有 AdminArbitrating 订单；
- 能在有 Delivery 的争议订单上执行「强制付款」，并验证 B 收款；
- 能在任何争议订单上执行「强制退款」，并验证 A 收款；
- 仲裁操作后，订单最终状态（Refunded/Paid/Completed）与资金流一致。
