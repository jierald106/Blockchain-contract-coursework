// scripts/refund1155.js
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  /*--------------------------------------------------------------
   * 0. 配置：投资者 signer、ICO 合约地址
   *-------------------------------------------------------------*/
  const [, investor] = await ethers.getSigners();        // 第二个账户
  const ICO_ADDRESS   = "0x7A52377A16D145D3CCb4A55eDb026D0118FF50F3";  // ← 修改成你的地址
  const ico           = await ethers.getContractAt("AdvancedICO1155", ICO_ADDRESS);

  /*--------------------------------------------------------------
   * 1. 调用前先打印投资者 ETH 余额
   *-------------------------------------------------------------*/
  const ethBefore = await ethers.provider.getBalance(investor.address);
  console.log("退款前 investor ETH：", ethers.formatEther(ethBefore), "ETH");

  /*--------------------------------------------------------------
   * 2. 执行 claimRefund()
   *    条件：finalized==true && totalRaised < softCap
   *-------------------------------------------------------------*/
  console.log(`⏳ 调用 claimRefund() …`);
  const tx = await ico.connect(investor).claimRefund();
  await tx.wait();
  console.log("✅ claimRefund 完成");

  /*--------------------------------------------------------------
   * 3. 再次打印投资者 ETH 余额
   *-------------------------------------------------------------*/
  const ethAfter = await ethers.provider.getBalance(investor.address);
  console.log("退款后 investor ETH：", ethers.formatEther(ethAfter), "ETH");
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("脚本执行出错：", err);
    process.exit(1);
  });
