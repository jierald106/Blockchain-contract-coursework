// scripts/ownerWithdraw20.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const [owner] = await ethers.getSigners();
  const ICO_ADDRESS = "0x88DA06D7d6E1687c68192D025a9472858111c79a";
  const ico = await ethers.getContractAt("GJHICO", ICO_ADDRESS);

  // 快进到 END 之后
  const end   = await ico.END();                  // bigint
  const blk   = await ethers.provider.getBlock("latest");
  if (BigInt(blk.timestamp) < end) {
    const delta = Number(end - BigInt(blk.timestamp) + 1n);
    console.log(`⏱ 快进 ${delta} 秒到 END…`);
    await network.provider.send("evm_increaseTime", [delta]);
    await network.provider.send("evm_mine");
  }

  // withdraw()
  console.log(`⏳ Owner ${owner.address} 调用 withdraw()…`);
  await (await ico.withdraw()).wait();
  console.log("✅ withdraw 完成");
}

main().catch(console.error);
