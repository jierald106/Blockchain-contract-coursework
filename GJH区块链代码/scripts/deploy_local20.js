// scripts/deploy_basic_ico.js
const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  // 1. 部署 ERC20
  const Token = await ethers.getContractFactory("GJHToken");
  const token = await Token.deploy(1_000_000);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("GJHToken 地址:", tokenAddr);

  // —— 新增：部署后查询 deployer 的 GJH 余额
  let depGJH = await token.balanceOf(deployer.address);
  console.log(
    "部署后 deployer GJH 余额：",
    ethers.formatUnits(depGJH, 18),
    "GJH"
  );

  // 2. 部署 GJHICO
  const ICO = await ethers.getContractFactory("GJHICO");
  const now   = (await ethers.provider.getBlock("latest")).timestamp;
  const start = now + 60;           // 1 分钟后
  const end   = now + 7 * 86400;    // 7 天后
  const ico = await ICO.deploy(
    tokenAddr,          // IERC20 _token
    deployer.address,   // address payable _treasury
    start,              // uint256 _start0
    end                 // uint256 _end
  );
  await ico.waitForDeployment();
  const icoAddr = await ico.getAddress();
  console.log("GJHICO 地址:", icoAddr);

  // —— 新增：部署后查询 ICO 合约的 GJH 余额（此时应为 0）
  let icoGJH = await token.balanceOf(icoAddr);
  console.log(
    "部署后 ICO 合约 GJH 余额：",
    ethers.formatUnits(icoGJH, 18),
    "GJH"
  );

  // —— 新增：打印合约当前汇率（部署前，start 尚未到，通常为 0）
  const initRate = await ico.currentRate();
  console.log("部署后 currentRate():", initRate.toString(), "GJH/ETH");

  // 3. 给 ICO 合约打入 500,000 GJH 用于售卖
  const saleAmount = ethers.parseUnits("500000", 18);
  const tx = await token.transfer(icoAddr, saleAmount);
  await tx.wait();
  console.log("已转账", ethers.formatUnits(saleAmount, 18), "GJH 到 ICO 合约");

  // —— 新增：转账后再次查询余额
  icoGJH = await token.balanceOf(icoAddr);
  depGJH = await token.balanceOf(deployer.address);
  console.log(
    "转账后 ICO 合约 GJH 余额：",
    ethers.formatUnits(icoGJH, 18),
    "GJH"
  );
  console.log(
    "转账后 deployer GJH 余额：",
    ethers.formatUnits(depGJH, 18),
    "GJH"
  );

  // —— 可选：快进到 start 后，再次打印 currentRate()
  await network.provider.send("evm_increaseTime", [61]);
  await network.provider.send("evm_mine");
  const postRate = await ico.currentRate();
  console.log("售卖开始后 currentRate():", postRate.toString(), "GJH/ETH");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
