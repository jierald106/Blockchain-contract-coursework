// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AdvancedICO1155
 * @notice 失败场景 ➜ 退款完后 Owner 手动 burnAllRemaining()；
 *         成功场景 ➜ withdraw() 自动 burnAllRemaining()。
 */
contract AdvancedICO1155 is Ownable, ReentrancyGuard, ERC1155Holder {
    /* --------------------------------------------------------------------- */
    /* 基本参数                                                               */
    /* --------------------------------------------------------------------- */
    IERC1155 public immutable token;
    uint256  public immutable tokenId;

    uint256  public constant RATE_PHASE1 = 1500 * 1e18;
    uint256  public constant RATE_PHASE2 = 1000 * 1e18;

    uint256  public startTime;
    uint256  public endTime;
    uint256  public softCap;
    uint256  public hardCap;
    uint256  public cliffDuration;
    uint256  public vestingDuration;

    uint256  public redemptionStart;
    uint256  public redemptionEnd;
    uint256  public redemptionRate;          // wei per token

    uint256  public totalRaised;
    bool     public finalized;

    struct Info {
        uint256 contributed;   // ETH paid-in
        uint256 purchased;     // token amount (18-decimals)
        uint256 claimed;       // token already vested & claimed
    }
    mapping(address => Info) public infos;

    /* --------------------------------------------------------------------- */
    /* 事件                                                                   */
    /* --------------------------------------------------------------------- */
    event TokensPurchased(address indexed buyer, uint256 ethAmt, uint256 tokenAmt);
    event Finalized(bool success);
    event TokensClaimed (address indexed user, uint256 amount);
    event RefundClaimed (address indexed user, uint256 amount);
    event Redeemed      (address indexed user, uint256 tokenAmt, uint256 ethAmt);
    /** burn 前后余额一次性输出，便于审计 */
    event Burned(uint256 icoBefore, uint256 ownerBefore, uint256 icoAfter, uint256 ownerAfter);

    /* --------------------------------------------------------------------- */
    /* 构造                                                                   */
    /* --------------------------------------------------------------------- */
    constructor(
        address _token,
        uint256 _tokenId,
        uint256 _start,
        uint256 _end,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _cliff,
        uint256 _vest
    ) Ownable(msg.sender) ReentrancyGuard() ERC1155Holder() {
        require(_start < _end,              "start>=end");
        require(_softCap <= _hardCap,       "soft>hard");
        require(_vest >= _cliff,            "vest<cliff");

        token           = IERC1155(_token);
        tokenId         = _tokenId;
        startTime       = _start;
        endTime         = _end;
        softCap         = _softCap;
        hardCap         = _hardCap;
        cliffDuration   = _cliff;
        vestingDuration = _vest;
    }

    /* --------------------------------------------------------------------- */
    /* 价格分段 & 购买                                                        */
    /* --------------------------------------------------------------------- */
    function currentRate() public view returns (uint256) {
        uint256 mid = startTime + (endTime - startTime) / 2;
        return block.timestamp <= mid ? RATE_PHASE1 : RATE_PHASE2;
    }

    modifier onlyWhileOpen() {
        require(block.timestamp >= startTime && block.timestamp <= endTime, "ICO not open");
        _;
    }

    function buyTokens() external payable nonReentrant onlyWhileOpen {
        require(msg.value > 0, "zero ETH");
        require(totalRaised + msg.value <= hardCap, "exceeds hardCap");

        uint256 tokenAmt = msg.value * currentRate() / 1 ether;
        Info storage inf = infos[msg.sender];
        inf.contributed += msg.value;
        inf.purchased   += tokenAmt;
        totalRaised     += msg.value;

        emit TokensPurchased(msg.sender, msg.value, tokenAmt);
    }

    /* --------------------------------------------------------------------- */
    /* Finalize / Refund                                                      */
    /* --------------------------------------------------------------------- */
    function finalize() external onlyOwner {
        require(!finalized, "done");
        require(block.timestamp > endTime || totalRaised >= hardCap, "not ended");
        finalized = true;
        emit Finalized(totalRaised >= softCap);
    }

    function claimRefund() external nonReentrant {
        Info storage inf = infos[msg.sender];
        require(finalized && totalRaised < softCap, "no refund");

        uint256 amt = inf.contributed;
        require(amt > 0, "none");
        inf.contributed = 0;
        payable(msg.sender).transfer(amt);
        emit RefundClaimed(msg.sender, amt);
    }

    /* --------------------------------------------------------------------- */
    /* Cliff + Vesting 领取                                                   */
    /* --------------------------------------------------------------------- */
    function claimVested() external nonReentrant {
        Info storage inf = infos[msg.sender];
        require(finalized && totalRaised >= softCap, "no success");
        uint256 elapsed = block.timestamp > endTime ? block.timestamp - endTime : 0;
        require(elapsed >= cliffDuration, "cliff");

        uint256 vested   = inf.purchased * _min(elapsed, vestingDuration) / vestingDuration;
        uint256 claimAmt = vested > inf.claimed ? vested - inf.claimed : 0;
        require(claimAmt > 0, "nothing");

        inf.claimed += claimAmt;
        token.safeTransferFrom(owner(), msg.sender, tokenId, claimAmt, "");
        emit TokensClaimed(msg.sender, claimAmt);
    }

    /* --------------------------------------------------------------------- */
    /* 赎回窗口 / Redeem                                                      */
    /* --------------------------------------------------------------------- */
    function setRedemptionWindow(uint256 _start, uint256 _end, uint256 _rate) external onlyOwner {
        require(_start < _end, "bad window");
        redemptionStart = _start;
        redemptionEnd   = _end;
        redemptionRate  = _rate;
    }

    function redeem(uint256 tokenAmt) external nonReentrant {
        require(finalized && totalRaised >= softCap, "no redeem");
        require(block.timestamp >= redemptionStart && block.timestamp <= redemptionEnd, "window");

        Info storage inf = infos[msg.sender];
        require(inf.claimed >= tokenAmt, "insufficient");
        inf.claimed -= tokenAmt;

        uint256 ethBack = tokenAmt * redemptionRate / 1 ether;
        token.safeTransferFrom(msg.sender, address(this), tokenId, tokenAmt, "");
        payable(msg.sender).transfer(ethBack);
        emit Redeemed(msg.sender, tokenAmt, ethBack);
    }

    /* --------------------------------------------------------------------- */
    /* Withdraw + 自动烧光                                                    */
    /* --------------------------------------------------------------------- */
    function withdraw() external onlyOwner {
        require(finalized, "not finalized");
        require(redemptionEnd == 0 || block.timestamp > redemptionEnd, "redeem not over");

        payable(owner()).transfer(address(this).balance);
        burnAllRemaining();                                // 成功路径自动烧光
    }

    /* --------------------------------------------------------------------- */
    /* burnAllRemaining                                                       */
    /* --------------------------------------------------------------------- */
    function burnAllRemaining() public onlyOwner {
        if (totalRaised < softCap) {
            require(address(this).balance == 0, "refunds not done");
        }

        ERC1155Burnable burnable = ERC1155Burnable(address(token));

        uint256 icoBefore   = token.balanceOf(address(this), tokenId);
        uint256 ownerBefore = token.balanceOf(owner(),        tokenId);

        if (icoBefore > 0)   burnable.burn(address(this), tokenId, icoBefore);
        if (ownerBefore > 0) burnable.burn(owner(),        tokenId, ownerBefore);

        uint256 icoAfter    = token.balanceOf(address(this), tokenId);
        uint256 ownerAfter  = token.balanceOf(owner(),        tokenId);
        emit Burned(icoBefore, ownerBefore, icoAfter, ownerAfter);
    }

    /* --------------------------------------------------------------------- */
    /* utils                                                                  */
    /* --------------------------------------------------------------------- */
    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
