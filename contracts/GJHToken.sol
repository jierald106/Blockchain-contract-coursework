// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GJHToken
 * @dev 一次性铸造固定数量代币，全部打给部署者（即初始 owner）
 */
contract GJHToken is ERC20, Ownable {
    uint8 public constant DECIMALS = 18;

    constructor(uint256 initialSupply)
        ERC20("GJHToken", "GJH")
        Ownable(msg.sender)          // <‑‑ v5.x 必须显式指定
    {
        _mint(msg.sender, initialSupply * (10 ** uint256(DECIMALS)));
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}

