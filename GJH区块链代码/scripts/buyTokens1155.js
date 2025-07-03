// scripts/buyTokens1155.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  // 0. 签名者 & 合约地址
  const [, buyer] = await ethers.getSigners();
  const ICO1155_ADDRESS = "0x5623AeBD9883783e3814f3dfd3d8B40211327B2e";

  // 1. 拿到 AdvancedICO1155 合约实例
  const ico1155 = await ethers.getContractAt("AdvancedICO1155", ICO1155_ADDRESS);

  // 2. 快进到开售时间（startTime）之后
  const startTime = await ico1155.startTime();
  const block     = await ethers.provider.getBlock("latest");
  if (BigInt(block.timestamp) < startTime) {
    const delta = Number(startTime - BigInt(block.timestamp) + 1n);
    console.log(`⏱ 快进 ${delta} 秒 到 startTime…`);
    await network.provider.send("evm_increaseTime", [delta]);
    await network.provider.send("evm_mine");
  }

  // 3. 读取参数 & 初始化 Token 实例
  const tokenAddr = await ico1155.token();
  const token     = await ethers.getContractAt("IERC1155", tokenAddr);
  // ERC1155 子代币 ID 在合约里叫 tokenId
  const saleId    = await ico1155.tokenId();
  const rate      = await ico1155.currentRate();

  // 4. 查询购买前余额
  console.log("ERC1155 汇率：", ethers.formatUnits(rate, 18), "token/ETH");
  const ethBefore = await ethers.provider.getBalance(buyer.address);
  const tokBefore = await token.balanceOf(buyer.address, saleId);
  console.log("购买前 buyer ETH：", ethers.formatEther(ethBefore));
  console.log(`购买前 buyer token(${saleId})：`, tokBefore.toString());

  // 5. 执行购买（这里示例 4 ETH）
  const value = ethers.parseEther("6.00");
  await (await ico1155.connect(buyer).buyTokens({ value })).wait();
  console.log("✅ buyTokens1155 完成");

  // 6. 查询购买后余额
  const ethAfter = await ethers.provider.getBalance(buyer.address);
  const tokAfter = await token.balanceOf(buyer.address, saleId);
  console.log("购买后 buyer ETH：", ethers.formatEther(ethAfter));
  console.log(`购买后 buyer token(${saleId})：`, tokAfter.toString());
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("脚本执行出错：", err);
    process.exit(1);
  });
