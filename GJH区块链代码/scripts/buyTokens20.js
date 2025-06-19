// scripts/buyTokens20.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  // 0. 拿到普通用户 signer
  const [, user] = await ethers.getSigners();

  // 1. 你的 GJHICO 合约地址
  const ICO_ADDRESS = "0x88DA06D7d6E1687c68192D025a9472858111c79a";
  const ico = await ethers.getContractAt("GJHICO", ICO_ADDRESS);

  // 2. 快进到 START
  const start = await ico.START();                     // bigint
  const block = await ethers.provider.getBlock("latest");
  if (BigInt(block.timestamp) < start) {
    const delta = Number(start - BigInt(block.timestamp) + 1n);
    console.log(`⏱ 快进 ${delta} 秒到 START…`);
    await network.provider.send("evm_increaseTime", [delta]);
    await network.provider.send("evm_mine");
  }

  // 3. 购买：直接用 hre.ethers.parseEther
  const ethAmount = ethers.parseEther("1.0");
  console.log(`⏳ 用户 ${user.address} 购买 1 ETH…`);
  await (await ico.connect(user).buyTokens({ value: ethAmount })).wait();
  console.log("✅ buyTokens 完成");

  // 4. 查询余额：直接用 hre.ethers.formatUnits
  const tokenAddr = await ico.token();
  const token     = await ethers.getContractAt("IERC20", tokenAddr);
  const bal       = await token.balanceOf(user.address);
  console.log("🔖 余额 =", ethers.formatUnits(bal, 18));
}

main().catch(console.error);
