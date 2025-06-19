/* test/advancedICO_1155.js */
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-network-helpers");

describe("AdvancedICO1155 功能测试", function () {
  const ONE_DAY  = 86_400;
  const ONE_YEAR = 31_536_000;          // 365 天

  let owner, user1, user2;
  let token, ico;
  let SALE_TOKEN_ID;
  let startTime, endTime;
  let cliffSecs, vestSecs;
  let rate;                              // 1 ETH 可换多少 tokenUnits

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
    cliffSecs   = 30 * ONE_DAY;         // Cliff = 30 天
    vestSecs    = ONE_YEAR;             // Vest  =  1 年
    rate        = ethers.parseUnits("1000", 18); // 1 ETH = 1000 token

    /* 3. 部署 ICO 合约 */
    const softCap = ethers.parseEther("10");
    const hardCap = ethers.parseEther("50");

    const AdvancedICO = await ethers.getContractFactory("AdvancedICO1155");
    ico = await AdvancedICO.deploy(
      await token.getAddress(),
      SALE_TOKEN_ID,
      rate,
      startTime,
      endTime,
      softCap,
      hardCap,
      cliffSecs,
      vestSecs
    );
    await ico.waitForDeployment();

    /* 4. 转入可售代币 */
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

    it("用户可以成功购买代币", async () => {
      await time.setNextBlockTimestamp(startTime + 1);

      const purchaseETH = ethers.parseEther("1");
      await ico.connect(user1).buyTokens({ value: purchaseETH });

      const contributed =
        (await ico.infos(user1.address)).contributed;
      expect(contributed).to.equal(purchaseETH);

      const purchased =
        (await ico.infos(user1.address)).purchased;
      const expected = purchaseETH * BigInt(rate) / 10n**18n;
      expect(purchased).to.equal(expected);
    });
  });

  describe("结束与领取", function () {
    it("未达软顶 → 可退款", async () => {
      await deployContracts(); // 独立部署场景

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

    it("达软顶 → 按 Cliff & Vesting 领取", async () => {
      await deployContracts(); // 独立部署场景

      /* 募资达软顶 */
      await time.setNextBlockTimestamp(startTime + 1);
      await ico.connect(user1).buyTokens({ value: ethers.parseEther("15") });
      await time.setNextBlockTimestamp(endTime + 1);
      await ico.finalize();

      /* Cliff 期间不得领取 */
      await expect(
        ico.connect(user1).claimVested()
      ).to.be.revertedWith("Cliff");

      /* Cliff 结束后首次领取 */
      const cliffUnlock = endTime + cliffSecs + 1;
      await time.setNextBlockTimestamp(cliffUnlock);

      const totalAllocation =
        (await ico.infos(user1.address)).purchased;

      await ico.connect(user1).claimVested();
      const balAfterFirst =
        await token.balanceOf(user1.address, SALE_TOKEN_ID);
      expect(balAfterFirst).to.be.gt(0n);
      expect(balAfterFirst).to.be.lt(totalAllocation);

      /* 全部解锁后领取剩余 */
      await time.setNextBlockTimestamp(cliffUnlock + vestSecs + 1);
      await ico.connect(user1).claimVested();
      const finalBal =
        await token.balanceOf(user1.address, SALE_TOKEN_ID);
      expect(finalBal).to.equal(totalAllocation);
    });
  });
});
