const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time }   = require("@nomicfoundation/hardhat-network-helpers");

describe("GJHICO & GJHToken 基本功能测试", function () {
  const ONE_DAY = 86400;
  let token, ico;
  let owner, user1, user2;

  /** 帮助函数：把链时间往前推若干“天”并出块 */
  async function advanceTime(days) {
    const now   = await time.latest();
    const later = now + days * ONE_DAY + 1;      // +1 秒保证往后
    await time.setNextBlockTimestamp(later);
    await ethers.provider.send("evm_mine");
    return later;
  }

  beforeEach(async function () {
    /** 1. 重置链状态（Hardhat 网络） */
    await ethers.provider.send("hardhat_reset");
    [owner, user1, user2] = await ethers.getSigners();

    /** 2. 部署 GJHToken，总量 1,000,000 */
    const Token = await ethers.getContractFactory("GJHToken");
    token = await Token.deploy(1_000_000);
    await token.waitForDeployment();

    /** 3. 计算动态 START / END，并部署 GJHICO */
    const now       = Number(await time.latest());
    const startTime = now + ONE_DAY;              // 明天开始
    const endTime   = startTime + 7 * ONE_DAY;    // 售卖 7 天

    const ICO = await ethers.getContractFactory("GJHICO");
    ico = await ICO.deploy(
      await token.getAddress(),
      owner.address,       // treasury
      startTime,
      endTime
    );
    await ico.waitForDeployment();

    /** 4. 时间拨到 START − 1 秒，方便后续测试 */
    await time.setNextBlockTimestamp(startTime - 1);
    await ethers.provider.send("evm_mine");

    /** 5. 给 ICO 合约转 500,000 枚 Token 作为库存 */
    await token.transfer(await ico.getAddress(), ethers.parseUnits("500000", 18));

    this.startTime = startTime;
    this.endTime   = endTime;
  });

  it("部署后代币总量正确", async function () {
    const ownerBal = await token.balanceOf(owner.address);
    expect(ownerBal).to.equal(ethers.parseUnits("500000", 18));

    const icoBal   = await token.balanceOf(await ico.getAddress());
    expect(icoBal).to.equal(ethers.parseUnits("500000", 18));
  });

  it("固定汇率正确", async function () {
    await advanceTime(1);
    expect(await ico.currentRate()).to.equal(1000);
  
    await advanceTime(2);
    expect(await ico.currentRate()).to.equal(1000);
  }); 
  it("买币功能正常", async function () {
    await advanceTime(1);
    await ico.connect(user1).buyTokens({ value: ethers.parseEther("1") });

    const bal = await token.balanceOf(user1.address);
    expect(bal).to.equal(ethers.parseUnits("1000", 18));
  });

  it("超时或售完会 revert", async function () {
    await advanceTime(1);
    await ico.connect(user1).buyTokens({ value: ethers.parseEther("500") });

    await expect(
      ico.connect(user2).buyTokens({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("ICO: sold out");

    const now  = await time.latest();
    const diff = this.endTime - now + 10;
    await advanceTime(Math.ceil(diff / ONE_DAY));

    await expect(
      ico.connect(user1).buyTokens({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("ICO: not active");
  });

  it("取款功能正常", async function () {
    await advanceTime(1);
    await ico.connect(user1).buyTokens({ value: ethers.parseEther("1") });

    const before = await ethers.provider.getBalance(await ico.getAddress());
    expect(before).to.equal(ethers.parseEther("1"));

    await ico.connect(owner).withdraw();

    const after = await ethers.provider.getBalance(await ico.getAddress());
    expect(after).to.equal(0);
  });

  it("非 owner 不能取款", async function () {
    await advanceTime(1);
    await ico.connect(user1).buyTokens({ value: ethers.parseEther("1") });
    await expect(ico.connect(user1).withdraw()).to.be.revertedWith("Not owner");
  });
});
