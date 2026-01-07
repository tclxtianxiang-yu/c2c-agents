# 合约接口清单（Hardhat / Solidity）— Escrow + MockUSDT（MVP）

> 目标：对齐 PRD 的链上闭环：A 预付 MockUSDT → 平台（后端）在验收/自动验收/仲裁时发起 payout/refund  
> 口径：链上只做**托管 + 结算/退款**；撮合、状态机、自动验收扫描、争议判断都在链下（NestJS）

---

## 0. 合约组成

### 0.1 MockUSDT（ERC-20 测试币）

- 用于 Sepolia 测试的 ERC-20 兼容代币
- 提供 faucet/mint（仅限 owner / 或允许 public faucet，按你们安全取舍）
- 前端支付时：A 把 MockUSDT `transfer` 到 escrow 合约地址（PRD 校验 Transfer 四元组）

### 0.2 Escrow 合约（托管池）

- 资金进入方式：**A → transfer(MockUSDT) → escrow**
- 资金出金方式：**平台后端的热钱包/管理员地址**调用：
  - `payout(orderId, provider, amountToProvider, feeToPlatform)`
  - `refund(orderId, creator, amountToCreator)`
- 幂等：链上用 `orderId` 做唯一业务键，保证一个 order 只能 payout 或 refund 一次
- 强制付款/退款：本质仍是 payout/refund，只是由 Admin 触发（链上不需要知道“争议”）

---

## 1. 关键设计约束（与 PRD 对齐）

1. **Escrow 不校验 Transfer 四元组**

- 该校验在链下完成（receipt.status + confirmations + Transfer 日志解析）
- Escrow 只负责保存余额与执行出金

2. **orderId 作为链上幂等主键**

- orderId 建议使用 `bytes32`（由后端对 Order.id 做 hash），或直接 `uint256`
- 链上记录每个 order 的结算状态（None / Paid / Refunded）

3. **出金权限**

- 仅允许 `OPERATOR_ROLE`（平台后端 signer）调用 payout/refund
- 可选 `ADMIN_ROLE`（仲裁）与 OPERATOR 合并，或分离

4. **金额单位**

- amount 使用 token 的最小单位（通常 6 或 18 decimals），链下负责换算一致

---

## 2. 接口：MockUSDT（合约函数 + 注释）

> 说明：若你们直接用 OpenZeppelin ERC20 + Ownable，下面是需要暴露给业务的最小接口。

### 2.1 必须实现（MVP 必需）

- `decimals() -> uint8`
- `mint(address to, uint256 amount)`（faucet/发币）
- `burn(address from, uint256 amount)`（可选，不影响主流程）
- 标准 ERC-20：
  - `transfer(address to, uint256 amount)`
  - `approve(address spender, uint256 amount)`
  - `transferFrom(address from, address to, uint256 amount)`
  - `balanceOf(address account)`

### 2.2 推荐事件

- `event FaucetMint(address indexed to, uint256 amount);`

### 2.3 Solidity 伪接口（注释口径）

```solidity
/// @title MockUSDT - Sepolia 测试用 ERC20
interface IMockUSDT {
  /// @notice 返回代币 decimals（务必与前后端换算一致）
  function decimals() external view returns (uint8);

  /// @notice 铸币：用于 faucet 给测试用户发放 MockUSDT
  /// @dev 建议 onlyOwner 或带限额的 public faucet
  function mint(address to, uint256 amount) external;

  /// @notice 标准 ERC20 transfer，用于 A 直接把钱转入 escrow
  function transfer(address to, uint256 amount) external returns (bool);

  /// @notice 标准 ERC20 approve
  function approve(address spender, uint256 amount) external returns (bool);

  /// @notice 标准 ERC20 transferFrom
  function transferFrom(address from, address to, uint256 amount) external returns (bool);

  /// @notice 查询余额
  function balanceOf(address account) external view returns (uint256);
}


⸻

3. 接口：Escrow 合约（核心）

3.1 状态与数据结构（建议）

/// @dev 订单资金状态：None=未处理，Paid=已付款给B，Refunded=已退款给A
enum SettlementStatus { None, Paid, Refunded }

/// @dev 记录每个 order 的结算信息（链上幂等）
struct Settlement {
  SettlementStatus status;
  address token;        // MockUSDT address
  address creator;      // A 地址（退款接收）
  address provider;     // B 地址（付款接收）
  uint256 grossAmount;  // 订单总额（进入 escrow 的金额）
  uint256 feeAmount;    // 手续费（付给平台）
  uint256 netAmount;    // 到 B 的金额
  uint64  timestamp;    // 结算发生时间
}

/// @dev 托管余额保护（记账式锁仓总额）
uint256 totalEscrowed; // 仅统计已 recordEscrow 的订单金额，用于 sweep 护栏

注意：链上不一定需要存全量字段，但为了审计与排查，建议保留最小可追溯信息。

⸻

3.2 必须实现函数（MVP P0）

A) 配置与权限

constructor(address token, address feeReceiver, address admin)
	•	初始化 MockUSDT 地址、平台手续费接收地址、admin/operator

setFeeReceiver(address newReceiver)
	•	仅 admin：修改手续费接收地址（平台热钱包变更时）

grantOperator(address operator) / revokeOperator(address operator)
	•	仅 admin：维护后端执行 payout/refund 的操作员地址（OPERATOR_ROLE）

⸻

B) 查询类

getSettlement(bytes32 orderId) -> Settlement
	•	链下可用它核对是否已结算（辅助幂等）

getStatus(bytes32 orderId) -> SettlementStatus
	•	返回订单状态（None/Paid/Refunded）

token() -> address
	•	返回 MockUSDT 地址（方便前端/后端读取）

feeReceiver() -> address
	•	返回手续费接收地址

⸻

C) 结算类（核心）

payout(bytes32 orderId, address creator, address provider, uint256 grossAmount, uint256 netAmount, uint256 feeAmount) -> (bool)
	•	仅 operator/admin：从 escrow 转出资金：
	•	netAmount 转给 provider（B）
	•	feeAmount 转给 feeReceiver（平台）
	•	要求：
	•	status[orderId] == None
	•	netAmount + feeAmount == grossAmount
	•	provider != address(0), creator != address(0)
	•	escrow 余额足够
	•	结算后写入 Settlement，状态变更为 Paid，触发事件

refund(bytes32 orderId, address creator, uint256 amount) -> (bool)
	•	仅 operator/admin：退款给 A
	•	要求：
	•	status[orderId] == None
	•	creator != address(0)
	•	escrow 余额足够
	•	退款后写入 Settlement，状态变更为 Refunded，触发事件

recordEscrow(bytes32 orderId, uint256 amount) -> (bool)
	•	仅 operator/admin：在链下确认支付后调用，登记托管金额
	•	amount > 0
	•	totalEscrowed += amount
	•	用于 sweep 保护（balance - totalEscrowed 为可转出余额）
	•	对接要求：Task 模块支付确认成功且 Order 创建成功后必须调用，失败需阻断后续状态流转

⸻

3.3 推荐实现函数（MVP 强烈建议）

sweep(address to, uint256 amount)
	•	仅 admin：紧急转出合约内多余 token（例如误转的 token）
	•	注意：必须避免影响已托管但未结算的资金（balance - totalEscrowed 为可转出余额）

pause() / unpause()
	•	仅 admin：紧急暂停 payout/refund（安全事故止血）
	•	需要在 payout/refund 上加 whenNotPaused

⸻

3.4 事件（必须）

/// @notice 付款成功（含平台手续费）
event Paid(
  bytes32 indexed orderId,
  address indexed token,
  address indexed provider,
  uint256 netAmount,
  address feeReceiver,
  uint256 feeAmount
);

/// @notice 退款成功
event Refunded(
  bytes32 indexed orderId,
  address indexed token,
  address indexed creator,
  uint256 amount
);

/// @notice 记录托管金额
event EscrowRecorded(bytes32 indexed orderId, uint256 amount);

/// @notice 费收地址变更
event FeeReceiverChanged(address indexed oldReceiver, address indexed newReceiver);

/// @notice 操作员变更
event OperatorGranted(address indexed operator);
event OperatorRevoked(address indexed operator);


⸻

3.5 Solidity 伪接口（注释口径）

/// @title Escrow - MockUSDT 托管与结算合约（链下状态机驱动）
interface IEscrow {
  /// @notice 返回托管使用的 token（MockUSDT）
  function token() external view returns (address);

  /// @notice 返回平台手续费接收地址
  function feeReceiver() external view returns (address);

  /// @notice 查询某订单的结算状态（None/Paid/Refunded）
  function getStatus(bytes32 orderId) external view returns (uint8);

  /// @notice 查询某订单结算详情（用于审计/排查/幂等）
  function getSettlement(bytes32 orderId) external view returns (
    uint8 status,
    address token,
    address creator,
    address provider,
    uint256 grossAmount,
    uint256 feeAmount,
    uint256 netAmount,
    uint64 timestamp
  );

  /// @notice 付款：把 escrow 中对应 grossAmount 按 net+fee 分发给 B 与平台
  /// @dev 仅 OPERATOR/ADMIN 可调用；幂等：同一 orderId 只能成功一次
  /// @param orderId 订单唯一业务键（建议 bytes32，由后端从 Order.id hash 得到）
  /// @param creator A 地址（用于记录；也可用于未来扩展）
  /// @param provider B 收款地址（以链下 WalletBinding 的 active 地址为准）
  /// @param grossAmount 订单总额（应等于链下校验得到的 escrowAmount）
  /// @param netAmount 打给 B 的金额（gross * (1 - feeRate)）
  /// @param feeAmount 手续费金额（gross * feeRate）
  function payout(
    bytes32 orderId,
    address creator,
    address provider,
    uint256 grossAmount,
    uint256 netAmount,
    uint256 feeAmount
  ) external returns (bool);

  /// @notice 退款：把 escrow 中金额退回给 A
  /// @dev 仅 OPERATOR/ADMIN 可调用；幂等：同一 orderId 只能成功一次
  /// @param orderId 订单唯一业务键
  /// @param creator A 收款地址
  /// @param amount 退款金额（通常等于 grossAmount）
  function refund(
    bytes32 orderId,
    address creator,
    uint256 amount
  ) external returns (bool);

  /// @notice 记录托管金额（链下确认支付后调用）
  /// @dev 仅 OPERATOR/ADMIN 可调用；幂等：同一 orderId 只能成功一次
  /// @param orderId 订单唯一业务键
  /// @param amount 订单托管金额（通常等于 escrowAmount）
  function recordEscrow(
    bytes32 orderId,
    uint256 amount
  ) external returns (bool);

  /// @notice 修改手续费接收地址
  /// @dev onlyAdmin
  function setFeeReceiver(address newReceiver) external;

  /// @notice 授予后端操作员权限（用于结算/退款）
  /// @dev onlyAdmin
  function grantOperator(address operator) external;

  /// @notice 撤销操作员权限
  /// @dev onlyAdmin
  function revokeOperator(address operator) external;

  /// @notice 紧急暂停（可选）
  function pause() external;

  /// @notice 恢复（可选）
  function unpause() external;
}


⸻

4. 资金模型（已采用记账式锁仓）

- Escrow 仍为 token 池子，但使用 `recordEscrow` 记账式锁仓：
  - 链下确认支付后 **必须** 调用 `recordEscrow(orderId, amount)`，写入托管金额
  - `totalEscrowed` 仅统计已 recordEscrow 的金额，用于 sweep 护栏
  - sweep 只能转出 `balance - totalEscrowed`，避免抽走在托管资金
- 如果未调用 recordEscrow，sweep 护栏无法覆盖该订单资金，属于严重风险

⸻

5. 与后端对接的输入输出约定（链下如何调用合约）

5.1 orderId 的生成
	•	推荐：bytes32 orderKey = keccak256(abi.encodePacked(orderId_uuid_string))
	•	后端与合约必须一致：同一 order 永远生成同一个 orderKey

5.2 payout 入参映射
	•	grossAmount = Order.escrowAmount
	•	feeAmount = grossAmount * feeRate
	•	netAmount = grossAmount - feeAmount
	•	provider = WalletBinding.active.address

5.3 refund 入参映射
	•	amount = Order.escrowAmount（全额退回）
	•	creator = A 当前钱包地址（下单支付地址）

⸻

6. 合约验收用例（最小集合）
	1.	A transfer MockUSDT 到 escrow → 链下校验通过 → recordEscrow 成功后：
	•	payout 成功：B 收到 net，平台收到 fee，Paid 事件 emitted，getStatus=Paid
	2.	A transfer MockUSDT 到 escrow → 链下校验通过 → recordEscrow 成功后：
	•	refund 成功：A 收到 amount，Refunded 事件 emitted，getStatus=Refunded
	3.	未 recordEscrow 的订单，payout/refund 必须 revert（Escrow amount mismatch）
	4.	幂等：同一 orderId 第二次 recordEscrow/payout/refund 必须 revert
	5.	权限：非 operator/admin 调用 recordEscrow/payout/refund 必须 revert
	6.	入参一致性：net+fee != gross 必须 revert（防止后端计算错误）

⸻

当前已采用“记账式锁仓（recordEscrow）”口径，合约与后端需严格按 recordEscrow → payout/refund 顺序执行。

```
