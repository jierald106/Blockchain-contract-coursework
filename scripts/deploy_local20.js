// scripts/deploy_basic_ico.js
const hre      = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  // 1. 部署 ERC20
  const Token = await ethers.getContractFactory("GJHToken");
  // 构造： constructor(uint256 initialSupply)
  const initialSupply = ethers.parseUnits("1000000", 18); // 1,000,000
  const token = await Token.deploy(initialSupply);
  await token.waitForDeployment();
  console.log("GJHToken 地址:", await token.getAddress());

  // 2. 部署 GJHICO
  const ICO = await ethers.getContractFactory("GJHICO");
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const start = now + 60;           // 1 分钟后
  const end   = now + 7 * 86400;    // 7 天后

  // 注意：构造函数只有四个参数 —— token、treasury、start、end
  const ico = await ICO.deploy(
    await token.getAddress(),  // IERC20 _token
    deployer.address,          // address payable _treasury
    start,                     // uint256 _start0
    end                        // uint256 _end
  );
  await ico.waitForDeployment();
  console.log("GJHICO 地址:", await ico.getAddress());

  // 3. 给 ICO 合约打入 500,000 GJH 用于售卖
  const saleAmount = ethers.parseUnits("500000", 18);
  await token.transfer(await ico.getAddress(), saleAmount);
  console.log("已转账 500,000 GJH 到 ICO 合约");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
