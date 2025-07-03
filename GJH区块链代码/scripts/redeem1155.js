// scripts/redeem1155_fixed.js — 赎回脚本 (兼容 ethers v5 / v6)
// 步骤：快进到赎回窗口 → setApprovalForAll → redeem 全额 token

const { ethers, network } = require("hardhat");

// ---------- 工具 ----------
function fmtEther(val) {
  return typeof ethers.formatEther === "function"
    ? ethers.formatEther(val)           // v6 bigint → string
    : ethers.utils.formatEther(val);    // v5 BigNumber → string
}
function fmtUnits(val, d = 18) {
  return typeof ethers.formatUnits === "function"
    ? ethers.formatUnits(val, d)
    : ethers.utils.formatUnits(val, d);
}

async function main() {
  // 0) 配置
  const [, buyer]   = await ethers.getSigners();
  const ICO_ADDR    = "0x4AF2841c9c3903eecA2547a20df401E31f428d79"; // TODO: 填真实地址
  const ico         = await ethers.getContractAt("AdvancedICO1155", ICO_ADDR);

  // 1) 快进到赎回窗口开始
  const start  = await ico.redemptionStart();            // v6 bigint | v5 BigNumber
  const nowBlk = await ethers.provider.getBlock("latest");
  const nowTS  = typeof start === "bigint" ? BigInt(nowBlk.timestamp) : nowBlk.timestamp;
  if (nowTS < start) {
    const delta = Number(start - nowTS + (typeof start === "bigint" ? 1n : 1));
    console.log(`⏩  快进 ${delta} 秒到 redemptionStart…`);
    await network.provider.send("evm_increaseTime", [delta]);
    await network.provider.send("evm_mine");
  }

  // 2) 读取余额
  const tokenAddr = await ico.token();
  const saleId    = await ico.tokenId();
  const token     = await ethers.getContractAt("IERC1155", tokenAddr);

  const ethBefore = await ethers.provider.getBalance(buyer.address);
  const tokBefore = await token.balanceOf(buyer.address, saleId);
  console.log("赎回前 buyer ETH:", fmtEther(ethBefore));
  console.log(`赎回前 buyer token(${saleId}):`, fmtUnits(tokBefore, 18));

  if (typeof tokBefore === "bigint" ? tokBefore === 0n : tokBefore.isZero()) {
    throw new Error("buyer 没有可赎回的 token");
  }

  // 3) 授权 (若尚未授权)
  const approved = await token.isApprovedForAll(buyer.address, ICO_ADDR);
  if (!approved) {
    console.log("🔑  setApprovalForAll 给 ICO…");
    await (await token.connect(buyer).setApprovalForAll(ICO_ADDR, true)).wait();
  }

  // 4) 赎回
  console.log("⏳ redeem", fmtUnits(tokBefore, 18), "token …");
  await (await ico.connect(buyer).redeem(tokBefore)).wait();
  console.log("✅ redeem 完成");

  // 5) 余额对比
  const ethAfter = await ethers.provider.getBalance(buyer.address);
  const tokAfter = await token.balanceOf(buyer.address, saleId);
  console.log("赎回后 buyer ETH:", fmtEther(ethAfter));
  console.log(`赎回后 buyer token(${saleId}):`, fmtUnits(tokAfter, 18));
}

main().catch(console.error);
