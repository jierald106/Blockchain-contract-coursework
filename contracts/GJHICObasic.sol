// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable }          from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 }           from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GJHICO
 * @dev 三阶段汇率示例 ICO
 */
contract GJHICO is ReentrancyGuard, Ownable {
    IERC20  public immutable token;            // 待售 ERC‑20
    address payable public immutable treasury; // 收 ETH 的金库地址

    uint256 public immutable START;            // ICO 开始时间
    uint256 public immutable END;              // ICO 结束时间

    uint256 private constant SECONDS_PER_DAY = 86_400;
    uint256[3] private _rate = [1000, 800, 600]; // 分阶段价格

    constructor(
        IERC20  _token,
        address payable _treasury,
        uint256 _start,
        uint256 _end
    )
        Ownable(msg.sender)                    // <‑‑ v5.x 必须显式指定
    {
        require(_start > block.timestamp, "ICO: start in past");
        require(_end   > _start,        "ICO: bad time range");

        token     = _token;
        treasury  = _treasury;
        START     = _start;
        END       = _end;
    }

    /* ======== 读取函数 ======== */

    /// 按当前时间段返回汇率；若不在售卖期则返回 0
    function currentRate() public view returns (uint256) {
        if (block.timestamp < START || block.timestamp > END) return 0;

        uint256 elapsed = block.timestamp - START;
        if (elapsed < 2 * SECONDS_PER_DAY) return _rate[0]; // 前 2 天
        if (elapsed < 5 * SECONDS_PER_DAY) return _rate[1]; // 第 3‑5 天
        return _rate[2];                                    // 其余天数
    }

    /* ======== 买币逻辑 ======== */

    receive() external payable { buyTokens(); }

    function buyTokens() public payable nonReentrant {
        uint256 rate = currentRate();
        require(rate > 0, "ICO: not active");
        require(msg.value > 0, "ICO: zero ETH");

        // 计算应得代币
        uint256 tokenAmount = msg.value * rate;
        require(
            token.balanceOf(address(this)) >= tokenAmount,
            "ICO: sold out"
        );

        // 发币
        require(
            token.transfer(msg.sender, tokenAmount),
            "ICO: token transfer failed"
        );
        // ETH 暂时留在合约，由 owner 后续统一提取
    }

    /* ======== 收款 ======== */

    /// 仅 owner 可提走合约收到的 ETH
    function withdraw() external nonReentrant {
        require(msg.sender == owner(), "Not owner");

        uint256 bal = address(this).balance;
        require(bal > 0, "ICO: no ETH");

        (bool ok, ) = treasury.call{value: bal}("");
        require(ok, "ICO: ETH send failed");
    }
}
