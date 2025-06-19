// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AdvancedICO1155
 * @dev ERC1155 版 ICO，支持：
 *   1) Cliff + Vesting 锁仓释放
 *   2) 动态汇率 setRate()
 *   3) 代币赎回（用户退回已领 token 换 ETH）
 *   4) 代币销毁（Owner 回收后 burnUnsold）
 */
contract AdvancedICO1155 is Ownable, ReentrancyGuard, ERC1155Holder {
    IERC1155 public immutable token;
    uint256 public immutable tokenId;

    uint256 public rate;            // 1 ETH -> rate tokenUnits（1e18 计）
    uint256 public startTime;
    uint256 public endTime;
    uint256 public softCap;
    uint256 public hardCap;
    uint256 public cliffDuration;
    uint256 public vestingDuration;

    uint256 public redemptionStart;
    uint256 public redemptionEnd;
    uint256 public redemptionRate;  // 1 token -> redemptionRate ETH (1e18 计)

    uint256 public totalRaised;
    bool    public finalized;

    struct Info {
        uint256 contributed;
        uint256 purchased;
        uint256 claimed;
    }
    mapping(address => Info) public infos;

    event RateUpdated(uint256 newRate);
    event TokensPurchased(address indexed buyer, uint256 ethAmt, uint256 tokenAmt);
    event Finalized(bool success);
    event TokensClaimed(address indexed user, uint256 amount);
    event RefundClaimed(address indexed user, uint256 amount);
    event Redeemed(address indexed user, uint256 tokenAmt, uint256 ethAmt);

    /**
     * @param _token       ERC1155 合约地址
     * @param _tokenId     售卖的 token ID
     * @param _rate        初始汇率（1 ETH 可换多少 tokenUnits）
     * @param _startTime   ICO 开始 unix 时间
     * @param _endTime     ICO 结束 unix 时间
     * @param _softCap     软顶（wei）
     * @param _hardCap     硬顶（wei）
     * @param _cliffDur    Cliff 时长（秒）
     * @param _vestDur     Vesting 总时长（秒）
     */
    constructor(
        address _token,
        uint256 _tokenId,
        uint256 _rate,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _cliffDur,
        uint256 _vestDur
    )
        Ownable(msg.sender)               // <-- OZ v5.x 必需
        ReentrancyGuard()                 // 可不写，留作示例
        ERC1155Holder()
    {
        require(_startTime < _endTime, "start>=end");
        require(_softCap <= _hardCap,   "soft>hard");
        require(_vestDur >= _cliffDur,   "vest<cliff");

        token           = IERC1155(_token);
        tokenId         = _tokenId;
        rate            = _rate;
        startTime       = _startTime;
        endTime         = _endTime;
        softCap         = _softCap;
        hardCap         = _hardCap;
        cliffDuration   = _cliffDur;
        vestingDuration = _vestDur;
    }

    modifier onlyWhileOpen() {
        require(block.timestamp >= startTime && block.timestamp <= endTime, "ICO not open");
        _;
    }

    /** 动态调整汇率 */
    function setRate(uint256 newRate) external onlyOwner {
        rate = newRate;
        emit RateUpdated(newRate);
    }

    /** 购买，不立即发给 token，仅记录分配 */
    function buyTokens() external payable nonReentrant onlyWhileOpen {
        require(msg.value > 0, "Zero ETH");
        require(totalRaised + msg.value <= hardCap, "Exceeds hardCap");

        uint256 tokenAmt = msg.value * rate / 1 ether;
        Info storage inf = infos[msg.sender];
        inf.contributed += msg.value;
        inf.purchased   += tokenAmt;
        totalRaised     += msg.value;

        emit TokensPurchased(msg.sender, msg.value, tokenAmt);
    }

    /** 结束 ICO，owner 调用 */
    function finalize() external onlyOwner {
        require(!finalized, "Already done");
        require(block.timestamp > endTime || totalRaised >= hardCap, "Not ended");
        finalized = true;
        bool success = totalRaised >= softCap;
        if (success) {
            payable(owner()).transfer(address(this).balance);
        }
        emit Finalized(success);
    }

    /** 领取已解锁的 token (Cliff + Vesting) */
    function claimVested() external nonReentrant {
        Info storage inf = infos[msg.sender];
        require(finalized && totalRaised >= softCap, "No success");
        uint256 elapsed = block.timestamp > endTime ? block.timestamp - endTime : 0;
        require(elapsed >= cliffDuration, "Cliff");

        uint256 vested   = inf.purchased * min(elapsed, vestingDuration) / vestingDuration;
        uint256 claimAmt = vested > inf.claimed ? vested - inf.claimed : 0;
        require(claimAmt > 0, "Nothing");

        inf.claimed += claimAmt;
        token.safeTransferFrom(owner(), msg.sender, tokenId, claimAmt, "");
        emit TokensClaimed(msg.sender, claimAmt);
    }

    /** 失败退款 */
    function claimRefund() external nonReentrant {
        Info storage inf = infos[msg.sender];
        require(finalized && totalRaised < softCap, "No refund");
        uint256 amt = inf.contributed;
        require(amt > 0, "None");
        inf.contributed = 0;
        payable(msg.sender).transfer(amt);
        emit RefundClaimed(msg.sender, amt);
    }

    /** 用户赎回：退 token 换 ETH（赎回期内） */
    function redeem(uint256 tokenAmt) external nonReentrant {
        require(finalized && totalRaised >= softCap, "No redeem");
        require(block.timestamp >= redemptionStart && block.timestamp <= redemptionEnd, "Window");
        Info storage inf = infos[msg.sender];
        require(inf.claimed >= tokenAmt, "Insufficient");

        inf.claimed -= tokenAmt;
        uint256 ethBack = tokenAmt * redemptionRate / 1 ether;
        token.safeTransferFrom(msg.sender, address(this), tokenId, tokenAmt, "");
        payable(msg.sender).transfer(ethBack);
        emit Redeemed(msg.sender, tokenAmt, ethBack);
    }

    /** 设置赎回窗口 & 赎回率 */
    function setRedemptionWindow(
        uint256 _start,
        uint256 _end,
        uint256 _rateEthPerToken
    ) external onlyOwner {
        require(_start < _end, "bad window");
        redemptionStart  = _start;
        redemptionEnd    = _end;
        redemptionRate   = _rateEthPerToken;
    }

    /** Owner 回收合约上的剩余 token，然后在 MyERC1155 调用 burn() 销毁 */
    function burnUnsold() external onlyOwner {
        uint256 bal = token.balanceOf(address(this), tokenId);
        require(bal > 0, "no tokens");
        token.safeTransferFrom(address(this), owner(), tokenId, bal, "");
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
