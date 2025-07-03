// 在脚本开头引入 Hardhat：
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const [owner] = await ethers.getSigners();
  const ICO_ADDRESS = "0x2aB20E2a82b5777566F2aF1ea04BE694ABB53879";
  const ico = await ethers.getContractAt("GJHICO", ICO_ADDRESS);

  // —— 快进到 END （同原来逻辑） —— //

  // **关键：在这里初始化 token**
  const tokenAddr = await ico.token();
  const token     = await ethers.getContractAt("IERC20", tokenAddr);

  // 1. 提取提现前余额
  const ethOwnerB = await ethers.provider.getBalance(owner.address);
  const gjhOwnerB = await token.balanceOf(owner.address);
  console.log("提现前 owner ETH：", ethers.formatEther(ethOwnerB));
  console.log("提现前 owner GJH：", ethers.formatUnits(gjhOwnerB, 18));

  // 2. 调用 withdraw()
  console.log(`⏳ Owner ${owner.address} 调用 withdraw()…`);
  await (await ico.withdraw()).wait();
  console.log("✅ claim 完成");

  // 3. 提取提现后余额
  const ethOwnerA = await ethers.provider.getBalance(owner.address);
  const gjhOwnerA = await token.balanceOf(owner.address);
  console.log("提现后 owner ETH：", ethers.formatEther(ethOwnerA));
  console.log("提现后 owner GJH：", ethers.formatUnits(gjhOwnerA, 18));
}

main().catch(console.error);
