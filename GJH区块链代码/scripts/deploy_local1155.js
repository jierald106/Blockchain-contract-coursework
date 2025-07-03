// scripts/deploy_local1155.js
const hre     = require("hardhat");
const { ethers } = hre;

async function main() {
  // 0. 拿到本地 chain 上的第 1 个账户，称为“部署者”
  const [deployer] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);

  // 1. 部署 ERC1155
  const MyERC1155 = await ethers.getContractFactory("MyERC1155");
  // 这里 uri 你可以填 ""（空字符串）跑通合约逻辑，也可以指向本地或线上 metadata 服务器
  const erc1155 = await MyERC1155.deploy("");
  // ethers v6 正确的等待方式：
  await erc1155.waitForDeployment();
  console.log("MyERC1155 部署完毕，地址：", await erc1155.getAddress());

  const saleId = await erc1155.SALE_TOKEN_ID();
  console.log("SALE_TOKEN_ID:", saleId.toString());
  const depBal = await erc1155.balanceOf(deployer.address, saleId);
  console.log("部署后 deployer 该 tokenId 余额：", ethers.formatUnits(depBal, 18), "token");

  // 2. 部署 AdvancedICO1155
  const now       = Math.floor(Date.now() / 1000);
  const start     = now + 60;                   // 1 分钟后开始
  const end       = now + 3600;                 // 1 小时后结束
  const softCap   = ethers.parseEther("5");     // 5 ETH 软顶
  const hardCap   = ethers.parseEther("20");    // 20 ETH 硬顶
  const cliff     = 600;                        // 10 分钟 Cliff
  const vesting   = 1800;                       // 30 分钟 Vest

  const ICO = await ethers.getContractFactory("AdvancedICO1155");
  const ico = await ICO.deploy(
    await erc1155.getAddress(),
    1,
    start,
    end,
    softCap,
    hardCap,
    cliff,
    vesting
  );
  await ico.waitForDeployment();

  console.log("AdvancedICO1155 部署完毕，地址：", await ico.getAddress());
  const curr = await ico.currentRate();
  console.log("AdvancedICO1155 初始汇率：", ethers.formatUnits(curr, 18), "token/ETH");
  // 3. 授权 ICO 合约给部署者的代币转移权限
  await erc1155.setApprovalForAll(await ico.getAddress(), true);
  console.log("授权完毕：ICO 合约可以转移部署者的代币。");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
