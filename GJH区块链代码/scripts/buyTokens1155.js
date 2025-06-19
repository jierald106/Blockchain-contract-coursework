// scripts/buyTokens1155.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const [, user] = await ethers.getSigners();
  const ICO1155 = "0x666cEFa019aDd482C8f08c79F2EaFEb2dC870232";
  const ico1155 = await ethers.getContractAt("AdvancedICO1155", ICO1155);

  // —— 快进到 startTime+1 —— 
  const startTime = await ico1155.startTime();
  const blk = await ethers.provider.getBlock("latest");
  if (BigInt(blk.timestamp) < startTime) {
    const delta = Number(startTime - BigInt(blk.timestamp) + 1n);
    console.log(`⏱ 快进 ${delta} 秒到 startTime…`);
    await network.provider.send("evm_increaseTime", [delta]);
    await network.provider.send("evm_mine");
  }

  // —— 确保不超 endTime —— 
  const endTime = await ico1155.endTime();
  const blk2 = await ethers.provider.getBlock("latest");
  if (BigInt(blk2.timestamp) > endTime) {
    throw new Error("已经超过 endTime，无法买入，请重置链或缩短脚本时间跳转");
  }

  // —— 买 0.5 ETH —— 
  const amt = ethers.parseEther("6");
  console.log(`⏳ ${user.address} 调用 buyTokens(${ethers.formatUnits(amt,18)} ETH)…`);
  await (await ico1155.connect(user).buyTokens({ value: amt })).wait();
  console.log("✅ buyTokens1155 完成");
}

main().catch(console.error);
