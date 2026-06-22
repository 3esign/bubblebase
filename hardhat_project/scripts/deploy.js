const hre = require("hardhat");

async function main() {
  console.log("Deploying Bubbles smart contract...");
  const BubblesFactory = await hre.ethers.getContractFactory("Bubbles");
  const bubbles = await BubblesFactory.deploy();
  await bubbles.waitForDeployment();
  const address = await bubbles.getAddress();
  console.log("Bubbles deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
