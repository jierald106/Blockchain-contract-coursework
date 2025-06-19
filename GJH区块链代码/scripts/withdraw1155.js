// scripts/refund1155.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const [, user] = await ethers.getSigners();
  const ICO1155 = "0x666cEFa019aDd482C8f08c79F2EaFEb2dC870232";
  const ico1155 = await ethers.getContractAt("AdvancedICO1155", ICO1155);

  // —— 必须先 finalize，否则会 revert "No refund" —— 
  // （你可以在 finalize1155.js 后直接跑本脚本）
  console.log(`⏳ ${user.address} 调用 claimRefund()…`);
  await (await ico1155.connect(user).claimRefund()).wait();
  console.log("✅ refund1155 完成");
}

main().catch(console.error);
