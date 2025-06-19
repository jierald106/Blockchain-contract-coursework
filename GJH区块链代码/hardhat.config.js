require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config(); // 让 .env 文件生效

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    // Hardhat 自带的本地链配置
    hardhat: {
      // chainId 一般默认是 31337，可以不写
    },
    // 如果你想用 Ganache GUI，也可以配置成下面这样：
    localhost: {
      url: "http://127.0.0.1:7545",// Ganache 默认端口
      chainId: 1337, // Ganache 默认链 ID
      // Ganache 会自动给你 10 个带私钥的测试账户，不需要写 accounts：
      // accounts: [...]
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY // 方便一键 Verify 源码
  }
};

