// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// ---------------------------------------------------------------------------
// Environment variables  (define these in your .env file – never commit it)
// ---------------------------------------------------------------------------
const ALCHEMY_API_KEY  = process.env.ALCHEMY_API_KEY  || "";
const PRIVATE_KEY      = process.env.PRIVATE_KEY      || "0".repeat(64);
const POLYGONSCAN_KEY  = process.env.POLYGONSCAN_API_KEY || "";

// ---------------------------------------------------------------------------
// NOTE: OpenZeppelin Contracts v5 requires solidity ≥ 0.8.24 and the Cancun
// EVM (for the `mcopy` opcode introduced in EIP-5656).  The compiler version
// is therefore set to 0.8.28 (latest stable) with evmVersion "cancun".
// Downgrading to 0.8.20 / paris causes an HH606 / TypeError at compile time.
// ---------------------------------------------------------------------------

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  // ── Solidity compiler ────────────────────────────────────────────────────
  solidity: {
    version: "0.8.28",          // ← satisfies OZ v5 `^0.8.24` requirement
    settings: {
      evmVersion: "cancun",     // ← required for `mcopy` in OZ v5 Bytes.sol
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  // ── Networks ─────────────────────────────────────────────────────────────
  networks: {
    // Local Hardhat node (default)
    hardhat: {},

    // Polygon Mumbai testnet
    mumbai: {
      url:      `https://polygon-mumbai.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [`0x${PRIVATE_KEY.replace(/^0x/, "")}`],
      chainId:  80001,
    },

    // Polygon Amoy testnet (current Mumbai replacement, April 2024+)
    amoy: {
      url:      `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [`0x${PRIVATE_KEY.replace(/^0x/, "")}`],
      chainId:  80002,
    },

    // Polygon Mainnet
    polygon: {
      url:      `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [`0x${PRIVATE_KEY.replace(/^0x/, "")}`],
      chainId:  137,
    },

    // Sepolia testnet
    sepolia: {
      url:      `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [`0x${PRIVATE_KEY.replace(/^0x/, "")}`],
      chainId:  11155111,
    }
  },

  // ── Polygonscan contract verification ────────────────────────────────────
  etherscan: {
    apiKey: {
      polygonMumbai: POLYGONSCAN_KEY,
      polygon:       POLYGONSCAN_KEY,
    },
  },

  // ── Gas reporter (opt-in via REPORT_GAS=true) ─────────────────────────────
  gasReporter: {
    enabled:  process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};