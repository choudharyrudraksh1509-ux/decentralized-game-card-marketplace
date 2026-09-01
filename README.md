# 🎴 Card Nexus — Decentralized Game Card Marketplace

A fully decentralized application (dApp) and Web3 gaming portal for minting, trading, patenting, buying, selling, and burning digital game cards as ERC-721 NFTs on Polygon / Localhost.

---

## 🌟 Key Features & Innovations

### 🎮 1. Full-Screen Gaming Auth Portal & Gatekeeper
* **Mandatory 1-to-1 Wallet Binding**: Every gamer account (Username/Email/Password) is bound 1-to-1 with their MetaMask wallet address upon registration.
* **JWT & Bcrypt Security**: Authenticated REST API with JWT tokens and bcrypt password hashing powered by an SQLite database (Sequelize ORM).
* **Self-Service Password Recovery**: Integrated password reset flow featuring 6-digit OTP verification codes with Nodemailer real email delivery and automated Ethereal Email test inbox previews.
* **👁️ Password Visibility Toggles**: Interactive show/hide password buttons across all login, sign-up, reset, and profile settings forms.

### 🛡️ 2. On-Chain Patenting & Self-Healing Anti-Duplication Engine
* **SHA-256 Cryptographic Fingerprinting**: Calculates deterministic SHA-256 hashes for both card artwork images and title/description metadata.
* **Dual-Layer Patenting**: Enforces copyright uniqueness on-chain via smart contract (`registeredHashes[contentHash]`) and off-chain via SQLite database (`CardRegistry`).
* **Self-Healing Copyright Release**: When a card is burned on-chain, the contract sets `registeredHashes[hashToUnregister] = false`. The backend features live on-chain `eth_call` verification so that if a card is burned, any stale database records are automatically released, allowing the creator to re-mint the artwork seamlessly!
* **Pre-Flight Hash Verification**: Pre-checks artwork hashes on-chain before opening MetaMask to prevent failing transaction popups.

### 🔥 3. On-Chain Deletion via "Card Burning"
* Blockchain ledger data is immutable, but Card Nexus enables card "deletion" by invoking `burnCard(tokenId)`.
* Burning transfers the NFT to the zero address (`0x0000000000000000000000000000000000000000`), removes active marketplace listings automatically, unregisters the copyright hash on-chain, and clears the item from the marketplace and user collection.

### ⚙️ 4. Polished User Profile & Uncluttered Header UI
* **Sleek Account Pill**: Replaced cluttered header buttons with a unified User Account Pill displaying the user's avatar, username, wallet address badge, Settings (⚙️), and Logout (🚪).
* **Avatar File Upload**: Dedicated avatar file uploader (`/upload-avatar`) with live image preview, completely decoupled from NFT copyright rules.
* **Integrated Wallet Management**: Easily copy bound wallet address or disconnect wallet directly inside the Settings modal.
* **Auto-Network Switcher**: Automatic chain detection enforcing target chain `31337` (Hardhat Localhost) before executing contract transactions.

### 🔄 5. Zero-Refresh Real-Time Syncing
* Uses **React Query cache invalidation** tied to Wagmi transaction receipts (`useWaitForTransactionReceipt`).
* Minting, listing, buying, and burning instantly refresh all collection grids, marketplace listings, history feeds, and ETH/MATIC balances in real-time without page reloads.

---

## 🛠️ Architecture & Tech Stack

* **Smart Contract**: Solidity `0.8.20`, OpenZeppelin ERC-721 URI Storage, Ownable, Hardhat development framework.
* **Frontend**: React 18, Vite, Wagmi v2, Viem, RainbowKit, TanStack React Query, TailwindCSS.
* **Backend**: Node.js, Express, Sequelize ORM, SQLite3, BcryptJS, JSONWebToken, Multer, Nodemailer.
* **Decentralized Storage**: NFT.storage (IPFS) with automatic local Mock IPFS fallback for offline/local dev testing.

---

## 🚀 Installation & Quick Start

### 1. Install Dependencies
```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 2. Run Smart Contract Test Suite (38 Tests)
```bash
npx hardhat test
```

### 3. Start Local Hardhat Node & Deploy Contract
In Terminal 1:
```bash
npx hardhat node
```
In Terminal 2, compile and deploy to local node:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
*(Copy the deployed contract address printed in the terminal and set `VITE_CONTRACT_ADDRESS` in `frontend/.env`)*

### 4. Start Express Backend & Database Server
In Terminal 3:
```bash
npm start --prefix backend
```

### 5. Launch React Web Application
In Terminal 4:
```bash
npm run dev --prefix frontend
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📜 License
MIT License. Created for Card Nexus Decentralized Gaming Marketplace.