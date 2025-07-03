// scripts/withdraw1155.js
const { ethers, network } = require("hardhat");

// -------- helpers --------
const fmtTok = v => (ethers.formatUnits ? ethers.formatUnits(v, 18)
                                        : ethers.utils.formatUnits(v, 18));
const fmtEth = v => (ethers.formatEther  ? ethers.formatEther(v)
                                        : ethers.utils.formatEther(v));

async function main () {
  const [owner] = await ethers.getSigners();
  const ICO_ADDR = "0x5623AeBD9883783e3814f3dfd3d8B40211327B2e";                    // ★ 请替换
  const ico      = await ethers.getContractAt("AdvancedICO1155", ICO_ADDR);

  /* 1️⃣ 检查赎回窗口是否已结束 */
  const end = await ico.redemptionEnd();
  const rn  = BigInt((await ethers.provider.getBlock("latest")).timestamp);
  const endBn = typeof end === "bigint" ? end : end.toBigInt();

  if (endBn > 0n && rn <= endBn) {
    console.log("⏳ 赎回期还没结束，先别 withdraw");
    return;                                        // 直接退出脚本
  }

  /* 2️⃣ 打印提钱前 ETH 余额 */
  const balWei = await ethers.provider.getBalance(ICO_ADDR);
  console.log("ICO 当前余额:", fmtEth(balWei), "ETH");

  /* 3️⃣ 调用 withdraw（内部会 burnAllRemaining） */
  const tx = await ico.connect(owner).withdraw();
  const rc = await tx.wait();

  /* 4️⃣ 解析 Burned 事件并打印 */
  const evt = rc.logs
                 .map(l => ico.interface.parseLog(l))
                 .find(p => p && p.name === "Burned");

  if (evt) {
    const { icoBefore, ownerBefore, icoAfter, ownerAfter } = evt.args;
    console.log(`✅ withdraw 完成，同时烧毁:
    ICO   : ${fmtTok(icoBefore)}  →  ${fmtTok(icoAfter)}
    Owner : ${fmtTok(ownerBefore)}  →  ${fmtTok(ownerAfter)}`);
  } else {
    console.log("✅ withdraw 完成（本次无 Burn 事件）");
  }
}

main().catch(console.error);
