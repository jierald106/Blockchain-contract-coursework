// scripts/checkSoftCap.js
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const ICO1155 = "0x7A52377A16D145D3CCb4A55eDb026D0118FF50F3";  // 换成你的地址
  const ico1155 = await ethers.getContractAt("AdvancedICO1155", ICO1155);

  const raised = await ico1155.totalRaised();    // bigint
  const cap    = await ico1155.softCap();        // bigint

  const raisedFormatted = ethers.formatEther(raised);
  const capFormatted    = ethers.formatEther(cap);

  console.log("========== SoftCap 状态 ==========");
  console.log("▶ 已筹集:", raisedFormatted, "ETH");
  console.log("▶ 软顶:",   capFormatted,    "ETH");

  if (raised < cap) {
    console.log("❌ 软顶未达，请调用 refund1155()");
  } else {
    console.log("✅ 软顶已达，请调用 claim1155()");
  }
}

main().catch(console.error);
