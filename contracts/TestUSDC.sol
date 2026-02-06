// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title TestUSDC
 * @notice Simple ERC20 token for testing on Sepolia
 * @dev Mimics USDC with 6 decimals
 */
contract TestUSDC is ERC20 {
    uint8 private constant _decimals = 6;

    constructor() ERC20("Test USDC", "tUSDC") {
        // Mint 1,000,000 tUSDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10 ** _decimals);
    }

    function decimals() public pure override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens for testing (anyone can mint)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
