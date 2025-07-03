// scripts/buyERC20.js
const { ethers } = require("hardhat");

async function main() {
  // ------------------------------------------------------------------
  // —— 1. 获取签名者：部署者 (owner) 和 买家 (buyer) ——
  // ------------------------------------------------------------------
  const [owner, buyer] = await ethers.getSigners();

  // ------------------------------------------------------------------
  // —— 2. 填入你已部署的 GJHICO 合约地址 和 对应的 ERC20 代币地址 ——
  // ------------------------------------------------------------------
  const ICO_ADDRESS   = "0x2aB20E2a82b5777566F2aF1ea04BE694ABB53879";       // 修改为你的 ICO 合约
  const TOKEN_ADDRESS = "0x44C37A98f4CD5e4015c73D140D9C0b5ABaAd83cB";     // 修改为你的 ERC20 Token 合约

  // ------------------------------------------------------------------
  // —— 3. 拿到合约实例 ——
  // ------------------------------------------------------------------
  const ico   = await ethers.getContractAt("GJHICO", ICO_ADDRESS);
  const token = await ethers.getContractAt("IERC20", TOKEN_ADDRESS);

  // ------------------------------------------------------------------
  // —— 4. 查询当前汇率 和 买家购买前余额 ——
  // ------------------------------------------------------------------
  const rate = await ico.currentRate();
  console.log(`买币时汇率: ${rate.toString()} GJH/ETH`);

  const ethBefore = await ethers.provider.getBalance(buyer.address);
  console.log(`购买前 buyer ETH: ${parseFloat(ethers.formatEther(ethBefore))}`);

  const gjhBefore = await token.balanceOf(buyer.address);
  console.log(`购买前 buyer GJH: ${parseFloat(ethers.formatUnits(gjhBefore, 18))}`);

  // ------------------------------------------------------------------
  // —— 5. 发起购买：这里以 1 ETH 为例 —— 
  // ------------------------------------------------------------------
  const ethAmount = ethers.parseEther("1.0");
  const tx = await ico.connect(buyer).buyTokens({ value: ethAmount });
  await tx.wait();
  console.log("✅ buyTokens 完成");

  // ------------------------------------------------------------------
  // —— 6. 购买后余额 —— 
  // ------------------------------------------------------------------
  const ethAfter = await ethers.provider.getBalance(buyer.address);
  console.log(`购买后 buyer ETH: ${parseFloat(ethers.formatEther(ethAfter))}`);

  const gjhAfter = await token.balanceOf(buyer.address);
  console.log(`购买后 buyer GJH: ${parseFloat(ethers.formatUnits(gjhAfter, 18))}`);

  // ------------------------------------------------------------------
  // —— 7. 最终 GJH 余额 —— 
  // ------------------------------------------------------------------
  console.log(`💰 最终余额 = ${parseFloat(ethers.formatUnits(gjhAfter, 18))}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
