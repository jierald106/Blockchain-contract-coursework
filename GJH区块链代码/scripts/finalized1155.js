// scripts/finalize1155.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const [owner] = await ethers.getSigners();
  const ICO1155 = "0x666cEFa019aDd482C8f08c79F2EaFEb2dC870232";
  const ico1155 = await ethers.getContractAt("AdvancedICO1155", ICO1155);

  // —— 快进到 endTime+1 或 硬顶 —— 
  const endTime = await ico1155.endTime();
  const blk = await ethers.provider.getBlock("latest");
  if (BigInt(blk.timestamp) < endTime) {
    const delta = Number(endTime - BigInt(blk.timestamp) + 1n);
    console.log(`⏱ 快进 ${delta} 秒到 endTime…`);
    await network.provider.send("evm_increaseTime", [delta]);
    await network.provider.send("evm_mine");
  }

  // —— 调用 finalize —— 
  console.log(`⏳ Owner ${owner.address} 调用 finalize()…`);
  await (await ico1155.finalize()).wait();
  console.log("✅ finalize 完成");
}

main().catch(console.error);
