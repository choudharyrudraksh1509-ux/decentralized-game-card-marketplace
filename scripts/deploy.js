// scripts/deploy.js  (CommonJS)
// Deploys GameCardMarketplace to the selected Hardhat network.
//
// Usage:
//   npx hardhat run scripts/deploy.js                    # local Hardhat node
//   npx hardhat run scripts/deploy.js --network mumbai   # Polygon Mumbai
//   npx hardhat run scripts/deploy.js --network amoy     # Polygon Amoy
//
// Required environment variables (see .env.example):
//   ALCHEMY_API_KEY       – Alchemy project key
//   PRIVATE_KEY           – Deployer wallet private key (without 0x prefix)
//   POLYGONSCAN_API_KEY   – Optional; needed only for --verify step

const { ethers } = require("hardhat");

async function main() {
  // ── Deployer info ─────────────────────────────────────────────────────────
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log("=".repeat(55));
  console.log("  Deploying GameCardMarketplace");
  console.log("=".repeat(55));
  console.log("  Deployer :", deployer.address);
  console.log("  Balance  :", ethers.formatEther(balance), "ETH / MATIC");
  console.log("-".repeat(55));

  // ── Deploy ────────────────────────────────────────────────────────────────
  // ethers.getContractFactory reads from artifacts/  (produced by `hardhat compile`)
  const GameCardMarketplace = await ethers.getContractFactory("GameCardMarketplace");

  // Constructor expects `initialOwner`; pass the deployer so they are the owner.
  const contract = await GameCardMarketplace.deploy(deployer.address);

  // Wait for the deployment transaction to be mined.
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  const deployTx        = contract.deploymentTransaction();

  console.log("  Contract :", deployedAddress);
  console.log("  Tx hash  :", deployTx.hash);
  console.log("=".repeat(55));

  // ── Post-deploy hints ─────────────────────────────────────────────────────
  console.log("\nNext steps:");
  console.log(
    `  1. Verify on Polygonscan:\n     npx hardhat verify --network <network> ${deployedAddress} "${deployer.address}"`
  );
  console.log(
    `  2. Add to frontend/.env:\n     VITE_CONTRACT_ADDRESS=${deployedAddress}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nDeployment failed:", err.message);
    process.exit(1);
  });