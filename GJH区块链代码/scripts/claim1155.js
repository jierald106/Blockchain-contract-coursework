// scripts/claim1155.js
const hre    = require("hardhat");
const { ethers } = hre;

// 将链上时间快进到 targetTs（秒级），若已过则只挖块
async function jumpTo(targetTs) {
  const block = await ethers.provider.getBlock("latest");
  const now   = block.timestamp;
  if (targetTs > now) {
    const diff = targetTs - now;
    await ethers.provider.send("evm_increaseTime", [diff]);
  }
  await ethers.provider.send("evm_mine");
}

async function main() {
  const [owner, buyer] = await ethers.getSigners();

  // —— 1. 把这里换成你的 AdvancedICO1155 部署地址 —— 
  const ICO_ADDR = "0x5623AeBD9883783e3814f3dfd3d8B40211327B2e";

  // 拿到合约实例
  const ico     = await ethers.getContractAt("AdvancedICO1155", ICO_ADDR);
  const token   = await ethers.getContractAt("IERC1155", await ico.token());
  const tokenId = await ico.tokenId();  // BigInt

  // —— 2. 若未达 softCap，自动补齐——
  const raised  = await ico.totalRaised();   // BigInt
  const softCap = await ico.softCap();       // BigInt
  if (raised < softCap) {
    console.log(`💰 current raised = ${ethers.formatEther(raised)} ETH, top up to softCap`);
    // 保证在募资窗口：startTime + 1s
    const startTime = await ico.startTime();  // BigInt
    await jumpTo(Number(startTime) + 1);
    const need = softCap - raised;
    await ico.connect(buyer).buyTokens({ value: need });
    console.log(`↗️  bought ${ethers.formatEther(need)} ETH worth`);
  }

  // —— 3. finalize（若尚未 finalize）——
  if (!(await ico.finalized())) {
    const endTime = await ico.endTime();      // BigInt
    await jumpTo(Number(endTime) + 1);
    await ico.connect(owner).finalize();
    console.log("✅ ICO finalized");
  }

  // —— 4. 跳到 vesting 结束后的时间点 —— 
  const endTime = await ico.endTime();        // BigInt
  const vestDur = await ico.vestingDuration();// BigInt
  await jumpTo(Number(endTime) + Number(vestDur) + 10);

  // —— 5. ClaimVested —— 
  const before = await token.balanceOf(buyer.address, tokenId);
  console.log(`领取前余额: ${ethers.formatUnits(before, 18)} token`);

  // 若 token 还在 owner 手里，需授权给 ICO 合约；否则可删掉
  await token.connect(owner).setApprovalForAll(ICO_ADDR, true);

  await ico.connect(buyer).claimVested();
  console.log("✅ claimVested succeeded");

  const after = await token.balanceOf(buyer.address, tokenId);
  console.log(`领取后余额: ${ethers.formatUnits(after, 18)} token`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
