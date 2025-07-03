// scripts/finalize1155.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const [owner] = await ethers.getSigners();
  const ICO1155 = "0x5623AeBD9883783e3814f3dfd3d8B40211327B2e";
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
  // —— 拿到合约地址 —— 
  const icoAddr = await ico1155.getAddress();
  const ethB   = await ethers.provider.getBalance(icoAddr);
  console.log("Finalize 前 ICO ETH：",ethers.formatEther(ethB));
  // —— 调用 finalize —— 
  console.log(`⏳ Owner ${owner.address} 调用 finalize()…`);
  await (await ico1155.connect(owner).finalize()).wait();
  console.log("✅ finalize 完成");
  const ethA   = await ethers.provider.getBalance(icoAddr);
  console.log("Finalize 后 ICO ETH：",ethers.formatEther(ethA));
}

main().catch(console.error);
