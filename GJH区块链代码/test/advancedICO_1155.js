/* test/advancedICO_1155_fixed.js */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-network-helpers");

/**
 * 适配 2025-07 更新版 AdvancedICO1155 合约：
 *   constructor(
 *     address _token,
 *     uint256 _tokenId,
 *     uint256 _start,
 *     uint256 _end,
 *     uint256 _softCap,
 *     uint256 _hardCap,
 *     uint256 _cliff,
 *     uint256 _vest
 *   )
 * - 不再传入 `rate`，速率写死在合约常量（1e18 精度）：
 *     RATE_PHASE1 = 1500e18, RATE_PHASE2 = 1000e18
 * - claimVested() 的 revert 字符串由 "Cliff" → "cliff"
 */

describe("AdvancedICO1155 功能测试 (2025-07 fix)", function () {
  const ONE_DAY  = 86_400;
  const ONE_YEAR = 31_536_000; // 365 天

  let owner, user1, user2;
  let token, ico;
  let SALE_TOKEN_ID;
  let startTime, endTime;
  let cliffSecs, vestSecs;

  /* ---------- 部署 & 初始化 ---------- */
  async function deployContracts() {
    [owner, user1, user2] = await ethers.getSigners();

    /* 1. 部署 ERC1155 */
    const MyERC1155 = await ethers.getContractFactory("MyERC1155");
    token = await MyERC1155.deploy("");
    await token.waitForDeployment();
    SALE_TOKEN_ID = await token.SALE_TOKEN_ID();

    /* 2. 时间 & 参数 */
    const now   = await time.latest();
    startTime   = now + ONE_DAY;
    endTime     = startTime + 7 * ONE_DAY;
    cliffSecs   = 30 * ONE_DAY;  // Cliff = 30 天
    vestSecs    = ONE_YEAR;      // Vest  = 1 年

    /* 3. 部署 ICO 合约（注意：无 rate 参数） */
    const softCap = ethers.parseEther("10");
    const hardCap = ethers.parseEther("50");

    const AdvancedICO = await ethers.getContractFactory("AdvancedICO1155");
    ico = await AdvancedICO.deploy(
      await token.getAddress(),
      SALE_TOKEN_ID,
      startTime,
      endTime,
      softCap,
      hardCap,
      cliffSecs,
      vestSecs
    );
    await ico.waitForDeployment();

    /* 4. 授权 ICO 合约可从 owner 转代币给买家 (Vesting) */
    await token.setApprovalForAll(await ico.getAddress(), true);
  }

  /* 每个 describe 内单独部署，避免状态串扰 */
  describe("购买与募资", function () {
    beforeEach(async () => { await deployContracts(); });

    it("不能在 ICO 开始前购买", async () => {
      await expect(
        ico.connect(user1).buyTokens({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("ICO not open");
    });

    it("用户可以成功购买代币，按实时汇率计算", async () => {
      await time.setNextBlockTimestamp(startTime + 1);

      const purchaseETH = ethers.parseEther("1");
      await ico.connect(user1).buyTokens({ value: purchaseETH });

      const contributed = (await ico.infos(user1.address)).contributed;
      expect(contributed).to.equal(purchaseETH);

      const purchased   = (await ico.infos(user1.address)).purchased;
      const currentRate = await ico.currentRate(); // e.g. 1500e18
      const expected    = purchaseETH * currentRate / 10n**18n;
      expect(purchased).to.equal(expected);
    });
  });

  describe("结束与领取", function () {
    it("未达软顶 → 可退款", async () => {
      await deployContracts();

      await time.setNextBlockTimestamp(startTime + 1);
      await ico.connect(user1).buyTokens({ value: ethers.parseEther("1") });

      await time.setNextBlockTimestamp(endTime + 1);
      await ico.finalize(); // 众筹失败

      const balBefore = await ethers.provider.getBalance(user1.address);
      const tx        = await ico.connect(user1).claimRefund();
      const rcpt      = await tx.wait();
      const gasUsed   = rcpt.gasUsed * rcpt.gasPrice;

      const balAfter  = await ethers.provider.getBalance(user1.address);
      expect(balAfter).to.be.closeTo(
        balBefore - gasUsed + ethers.parseEther("1"),
        ethers.parseEther("0.001")
      );
    });

    it("达软顶 → Cliff & Vesting 领取", async () => {
      await deployContracts();

      /* 募资达软顶 */
      await time.setNextBlockTimestamp(startTime + 1);
      await ico.connect(user1).buyTokens({ value: ethers.parseEther("15") });
      await time.setNextBlockTimestamp(endTime + 1);
      await ico.finalize();

      /* Cliff 期内不可领取 */
      await expect(
        ico.connect(user1).claimVested()
      ).to.be.revertedWith("cliff");

      /* Cliff 结束后首次领取 */
      const cliffUnlock = endTime + cliffSecs + 1;
      await time.setNextBlockTimestamp(cliffUnlock);

      const totalAllocation = (await ico.infos(user1.address)).purchased;

      await ico.connect(user1).claimVested();
      const balAfterFirst   = await token.balanceOf(user1.address, SALE_TOKEN_ID);
      expect(balAfterFirst).to.be.gt(0n);
      expect(balAfterFirst).to.be.lt(totalAllocation);

      /* 全部解锁后领取剩余 */
      await time.setNextBlockTimestamp(cliffUnlock + vestSecs + 1);
      await ico.connect(user1).claimVested();
      const finalBal = await token.balanceOf(user1.address, SALE_TOKEN_ID);
      expect(finalBal).to.equal(totalAllocation);
    });
  });
/* ---------- 场景 4：赎回 / 提现 / burnAllRemaining ---------- */
  describe("赎回 / 提现 / burnAllRemaining", function () {

    beforeEach(async () => { await deployContracts(); });

    it("完整走一次赎回→提现→自动销毁", async () => {

      /* -------- 达 softCap，募资成功 -------- */
      await time.setNextBlockTimestamp(startTime + 5);
      await ico.connect(user1).buyTokens({ value: ethers.parseEther("20") });

      await time.setNextBlockTimestamp(endTime + 1);
      await ico.finalize();

      /* -------- 跳过 cliff+vesting，全额领取 -------- */
      await time.setNextBlockTimestamp(endTime + cliffSecs + vestSecs + 10);
      await ico.connect(user1).claimVested();
      const totalGot = await token.balanceOf(user1.address, SALE_TOKEN_ID);

      /* -------- owner 开赎回窗口 -------- */
      const rwStart = await time.latest();
      const rwEnd   = rwStart + ONE_DAY;
      const rwRate  = ethers.parseEther("0.0005");        // 0.0005 ETH / token
      await ico.setRedemptionWindow(rwStart, rwEnd, rwRate);

      /* -------- 用户赎回一半 -------- */
      await token.connect(user1).setApprovalForAll(await ico.getAddress(), true);

      const redeemAmt  = totalGot / 2n;
      const ethBefore  = await ethers.provider.getBalance(user1.address);

      const txRedeem   = await ico.connect(user1).redeem(redeemAmt);
      const rcptRedeem = await txRedeem.wait();
      const gasSpent   = rcptRedeem.gasUsed * rcptRedeem.gasPrice;

      const ethAfter   = await ethers.provider.getBalance(user1.address);
      const deltaPlusGas = ethAfter + gasSpent - ethBefore;

      expect(deltaPlusGas).to.equal(redeemAmt * rwRate / 10n ** 18n);

      /* -------- 赎回期结束 → owner 提现 -------- */
      await time.setNextBlockTimestamp(rwEnd + 1);

      const ownerEthBefore = await ethers.provider.getBalance(owner.address);
      const txWithdraw     = await ico.withdraw();
      const rcptWithdraw   = await txWithdraw.wait();
      const gasOwnerSpent  = rcptWithdraw.gasUsed * rcptWithdraw.gasPrice;

      const ownerEthAfter  = await ethers.provider.getBalance(owner.address);
      expect(ownerEthAfter + gasOwnerSpent).to.be.gt(ownerEthBefore);

      /* -------- token 余量已全部烧光 -------- */
      const icoBal   = await token.balanceOf(await ico.getAddress(), SALE_TOKEN_ID);
      const ownerBal = await token.balanceOf(owner.address,           SALE_TOKEN_ID);
      expect(icoBal).to.equal(0n);
      expect(ownerBal).to.equal(0n);
    });
  });
});
