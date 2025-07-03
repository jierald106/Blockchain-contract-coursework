const { ethers } = require("hardhat");
const fmt = (v) =>
  (ethers.formatUnits ? ethers.formatUnits(v, 18)    // v6 bigint
                       : ethers.utils.formatUnits(v, 18)); // v5 BigNumber
async function main () {
  const [owner] = await ethers.getSigners();
  const ico = await ethers.getContractAt(
      "AdvancedICO1155",
      "0x7A52377A16D145D3CCb4A55eDb026D0118FF50F3"
  );

  // 调用 burnAllRemaining()
  const tx = await ico.connect(owner).burnAllRemaining();
  const rc = await tx.wait();

  // 解析 Burned 事件
  const evt = rc.logs
                .map(l => ico.interface.parseLog(l))
                .find(p => p && p.name === "Burned");

  if (evt) {
    const { icoBefore, ownerBefore, icoAfter, ownerAfter } = evt.args;
    console.log(`
🔥 Burned (token 单位):
  ICO   : ${fmt(icoBefore)}  →  ${fmt(icoAfter)}
  Owner : ${fmt(ownerBefore)}  →  ${fmt(ownerAfter)}`);
  } else {
    console.log("⚠️  Burned event not found");
  }
}

main().catch(console.error);
