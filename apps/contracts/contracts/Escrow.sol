// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AccessControl } from '@openzeppelin/contracts/access/AccessControl.sol';
import { Pausable } from '@openzeppelin/contracts/utils/Pausable.sol';
import { ReentrancyGuard } from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { SafeERC20 } from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract Escrow is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256('OPERATOR_ROLE');

    enum SettlementStatus {
        None,
        Paid,
        Refunded
    }

    struct Settlement {
        SettlementStatus status;
        address token;
        address creator;
        address provider;
        uint256 grossAmount;
        uint256 feeAmount;
        uint256 netAmount;
        uint64 timestamp;
    }

    IERC20 public immutable token;
    address public feeReceiver;
    uint256 public totalEscrowed;

    mapping(bytes32 => Settlement) private settlements;
    mapping(bytes32 => uint256) public escrowedAmounts;

    event Paid(
        bytes32 indexed orderId,
        address indexed token,
        address indexed provider,
        uint256 netAmount,
        address feeReceiver,
        uint256 feeAmount
    );
    event Refunded(bytes32 indexed orderId, address indexed token, address indexed creator, uint256 amount);
    event EscrowRecorded(bytes32 indexed orderId, uint256 amount);
    event FeeReceiverChanged(address indexed oldReceiver, address indexed newReceiver);
    event OperatorGranted(address indexed operator);
    event OperatorRevoked(address indexed operator);

    constructor(address tokenAddress, address feeReceiverAddress, address admin) {
        require(tokenAddress != address(0), 'Escrow: token is zero');
        require(feeReceiverAddress != address(0), 'Escrow: feeReceiver is zero');
        require(admin != address(0), 'Escrow: admin is zero');

        token = IERC20(tokenAddress);
        feeReceiver = feeReceiverAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function getSettlement(bytes32 orderId) external view returns (Settlement memory) {
        return settlements[orderId];
    }

    function getStatus(bytes32 orderId) external view returns (SettlementStatus) {
        return settlements[orderId].status;
    }

    function setFeeReceiver(address newReceiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newReceiver != address(0), 'Escrow: feeReceiver is zero');

        address oldReceiver = feeReceiver;
        feeReceiver = newReceiver;

        emit FeeReceiverChanged(oldReceiver, newReceiver);
    }

    function grantOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(operator != address(0), 'Escrow: operator is zero');

        _grantRole(OPERATOR_ROLE, operator);
        emit OperatorGranted(operator);
    }

    function revokeOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(OPERATOR_ROLE, operator);
        emit OperatorRevoked(operator);
    }

    function recordEscrow(bytes32 orderId, uint256 amount) external whenNotPaused nonReentrant returns (bool) {
        _assertOperatorOrAdmin();
        require(amount > 0, 'Escrow: escrow amount is zero');
        require(escrowedAmounts[orderId] == 0, 'Escrow: escrow already recorded');

        uint256 balance = token.balanceOf(address(this));
        require(balance >= totalEscrowed + amount, 'Escrow: insufficient balance for escrow');

        escrowedAmounts[orderId] = amount;
        totalEscrowed += amount;

        emit EscrowRecorded(orderId, amount);
        return true;
    }

    function payout(
        bytes32 orderId,
        address creator,
        address provider,
        uint256 grossAmount,
        uint256 netAmount,
        uint256 feeAmount
    ) external whenNotPaused nonReentrant returns (bool) {
        _assertOperatorOrAdmin();
        require(creator != address(0), 'Escrow: creator is zero');
        require(provider != address(0), 'Escrow: provider is zero');
        require(grossAmount > 0, 'Escrow: grossAmount is zero');
        require(netAmount + feeAmount == grossAmount, 'Escrow: amount mismatch');

        Settlement storage existing = settlements[orderId];
        require(existing.status == SettlementStatus.None, 'Escrow: already settled');
        _consumeEscrowed(orderId, grossAmount);

        token.safeTransfer(provider, netAmount);
        token.safeTransfer(feeReceiver, feeAmount);

        settlements[orderId] = Settlement({
            status: SettlementStatus.Paid,
            token: address(token),
            creator: creator,
            provider: provider,
            grossAmount: grossAmount,
            feeAmount: feeAmount,
            netAmount: netAmount,
            timestamp: uint64(block.timestamp)
        });

        emit Paid(orderId, address(token), provider, netAmount, feeReceiver, feeAmount);
        return true;
    }

    function refund(
        bytes32 orderId,
        address creator,
        uint256 amount
    ) external whenNotPaused nonReentrant returns (bool) {
        _assertOperatorOrAdmin();
        require(creator != address(0), 'Escrow: creator is zero');
        require(amount > 0, 'Escrow: amount is zero');

        Settlement storage existing = settlements[orderId];
        require(existing.status == SettlementStatus.None, 'Escrow: already settled');
        _consumeEscrowed(orderId, amount);

        token.safeTransfer(creator, amount);

        settlements[orderId] = Settlement({
            status: SettlementStatus.Refunded,
            token: address(token),
            creator: creator,
            provider: address(0),
            grossAmount: amount,
            feeAmount: 0,
            netAmount: 0,
            timestamp: uint64(block.timestamp)
        });

        emit Refunded(orderId, address(token), creator, amount);
        return true;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function sweep(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), 'Escrow: sweep to zero');
        require(amount > 0, 'Escrow: sweep amount is zero');

        uint256 balance = token.balanceOf(address(this));
        require(balance >= totalEscrowed, 'Escrow: escrow exceeds balance');
        require(amount <= balance - totalEscrowed, 'Escrow: sweep exceeds available');

        token.safeTransfer(to, amount);
    }

    function _consumeEscrowed(bytes32 orderId, uint256 amount) private {
        uint256 reserved = escrowedAmounts[orderId];
        require(reserved == amount, 'Escrow: escrowed amount mismatch');
        totalEscrowed -= reserved;
        delete escrowedAmounts[orderId];
    }

    function _assertOperatorOrAdmin() private view {
        if (!hasRole(OPERATOR_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert('Escrow: missing operator/admin role');
        }
    }
}
