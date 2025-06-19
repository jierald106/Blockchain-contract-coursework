// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MyERC1155
 * @dev ERC1155 + Burnable，用于 ICO 售卖
 */
contract MyERC1155 is ERC1155, ERC1155Burnable, Ownable {
    uint256 public constant SALE_TOKEN_ID  = 1;
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10 ** 18;

    /**
     * @param uri 元数据 URI，例如 "https://example.com/{id}.json"
     * 
     * 注意：OZ v5.x 里，Ownable 构造器需要一个 initialOwner 地址
     */
    constructor(string memory uri)
        ERC1155(uri)
        Ownable(msg.sender)
    {
        _mint(msg.sender, SALE_TOKEN_ID, INITIAL_SUPPLY, "");
    }
}

