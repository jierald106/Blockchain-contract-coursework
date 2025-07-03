// scripts/testDynamicRates.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  // ① 实例化 ICO 合约
  const ico = await ethers.getContractAt(
    "AdvancedICO1155",
    "0x4AF2841c9c3903eecA2547a20df401E31f428d79"
  );

  // ② 读取时间 —— 注意：都是 bigint
  const start = await ico.startTime();  // bigint
  const end   = await ico.endTime();    // bigint
  const mid   = start + (end - start) / 2n;

 // ---------- Phase 1 ----------
  let delta = Number(start + 1n - BigInt((await ethers.provider.getBlock("latest")).timestamp));
  await network.provider.send("evm_increaseTime", [delta]);
  await network.provider.send("evm_mine");
  console.log("Phase 1 rate =", ethers.formatUnits(await ico.currentRate(), 18));

// ---------- Phase 2 ----------
  delta = Number(mid + 1n - BigInt((await ethers.provider.getBlock("latest")).timestamp));
  await network.provider.send("evm_increaseTime", [delta]);
  await network.provider.send("evm_mine");
  console.log("Phase 2 rate =", ethers.formatUnits(await ico.currentRate(), 18));
}

main().catch(console.error);

