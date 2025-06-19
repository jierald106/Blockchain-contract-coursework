// scripts/claim1155.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const [, user] = await ethers.getSigners();
  // 这里填你实际的 AdvancedICO1155 合约地址
  const ICO1155 = "0x666cEFa019aDd482C8f08c79F2EaFEb2dC870232";
  const ico1155 = await ethers.getContractAt("AdvancedICO1155", ICO1155);

  // 确保已经 finalize() 且 softCap 已达
  // （前面你已经跑过 finalize1155.js 并确认了软顶状态）

  // 1) 读取 endTime 和 cliffDuration
  const endTime       = await ico1155.endTime();          // uint256
  const cliffDuration = await ico1155.cliffDuration();    // uint256

  // 2) 如果还没到 endTime + cliffDuration，就快进
  const blk    = await ethers.provider.getBlock("latest");
  const target = endTime + cliffDuration;
  if (BigInt(blk.timestamp) < target) {
    const delta = Number(target - BigInt(blk.timestamp) + 1n);
    console.log(`⏱ 快进 ${delta} 秒，到达 endTime + cliffDuration…`);
    await network.provider.send("evm_increaseTime", [delta]);
    await network.provider.send("evm_mine");
  }

  // 3) 真正调用 claimVested()
  console.log(`⏳ ${user.address} 调用 claimVested()…`);
  await (await ico1155.connect(user).claimVested()).wait();
  console.log("✅ claimVested 完成");
}

main().catch(console.error);
