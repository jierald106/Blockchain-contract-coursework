const { ethers, network } = require("hardhat");

async function main () {
  const [owner] = await ethers.getSigners();
  const icoAddr = "0x4AF2841c9c3903eecA2547a20df401E31f428d79";              // ICO 地址
  const ico     = await ethers.getContractAt("AdvancedICO1155", icoAddr);

  const endTime = await ico.endTime();  // bigint (v6) | BigNumber (v5)

  // 赎回窗口：预售结束后 1h ~ 2h
  const start = (typeof endTime === "bigint") ? endTime + 3600n
                                              : endTime.add(3600);
  const finish= (typeof endTime === "bigint") ? endTime + 7200n
                                              : endTime.add(7200);

  // 1 ETH ↔ 1500 token  →  redemptionRate = 1/1500 ETH = 666… wei
  const rate  = (typeof ethers.parseEther === "function")
                  ? ethers.parseEther("1") / 1500n        // v6 bigint
                  : ethers.utils.parseEther("1").div(1500); // v5 BigNumber

  console.log("设置赎回窗口",
              "start =", start.toString(),
              "end =",   finish.toString(),
              "rate =",  (ethers.formatEther ? ethers.formatEther(rate)
                                             : ethers.utils.formatEther(rate)),
              "ETH / token");

  await (await ico.setRedemptionWindow(1, 2, 0)).wait();//赎回期未结束将参数换成（1,2,0）
  console.log("✅ Redemption window set");
}

main().catch(console.error);
