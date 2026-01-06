// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import { Ownable } from '@openzeppelin/contracts/access/Ownable.sol';

contract MockUSDT is ERC20, Ownable {
    uint8 private constant TOKEN_DECIMALS = 6;
    uint256 private constant FAUCET_AMOUNT = 1000 * 10 ** TOKEN_DECIMALS;

    constructor() ERC20('MockUSDT', 'mUSDT') Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
