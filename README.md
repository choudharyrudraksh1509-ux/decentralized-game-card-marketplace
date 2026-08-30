# 🎴 Card Nexus — Decentralized Game Card Marketplace

A fully decentralized application (dApp) for minting, buying, selling, and burning digital game cards as ERC-721 NFTs on Polygon / Localhost.

---

## 🚀 What Makes Card Nexus Unique & Better?

### 🔥 1. On-Chain Deletion via "Burning"
In traditional web development, deleting data is as simple as running a `DELETE` query. On the blockchain, data is **immutable and permanent**—it can never be deleted from the historical ledger. 

Card Nexus addresses this standard Web3 limitation by implementing a **"Burning"** mechanism (`burnCard`):
* Users can "delete" a card from their collection by burning it.
* Under the hood, this transfers the token to the zero address (`0x0000000000000000000000000000000000000000`), permanently removing it from circulation.
* The contract automatically cancels any active marketplace listings for that card before burning.
* Once burned, the card disappears from the owner's collection and the marketplace forever.

### 🔄 2. Zero-Refresh Real-Time Syncing
Many standard dApps suffer from poor user experience, requiring manual page refreshes to see updated listings or balances after a transaction. 
* Card Nexus utilizes **React Query cache invalidation** hooked into Wagmi transaction receipts.
* As soon as MetaMask confirms a transaction (Minting, Listing, Canceling, Buying, or Burning), the cache is invalidated in the background.
* The UI instantly refreshes all collection grids, marketplace grids, history feeds, and ETH/MATIC balances in real-time without requiring a page reload.

### ⚡ 3. Static RPC Event History
The "History" timeline parses live on-chain smart contract events (`CardMinted`, `CardListed`, `CardSale`, `ListingCancelled`, `CardBurned`).
* Instead of relying on the active wallet provider (which fails or switches to Mainnet when disconnected), we configure a **dedicated static RPC client** pointing to the target network.
* This ensures that the history feed is active and displays historical events even when the user's wallet is completely disconnected.

---

## 🛠️ Development & Setup

Follow these steps to set up, test, and deploy the project locally:

### 1. Install Dependencies
Install dependencies at the project root, frontend, and backend:
```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

### 2. Run Smart Contract Tests
Execute the unit test suite covering minting, listing, cancelation, buying, re-entrancy, and burn edge-cases (38 tests):
```bash
npx hardhat test
```

### 3. Deploy Contract to Local Node
Start a local Hardhat node:
```bash
npx hardhat node
```
In a new terminal window, compile and deploy the contract:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
*Note: Copy the contract address printed in the terminal and update `VITE_CONTRACT_ADDRESS` in `frontend/.env`.*

### 4. Start the Backend Storage Bridge
Start the local Express server simulating IPFS storage for images and metadata:
```bash
npm start --prefix backend
```

### 5. Start the React Frontend
Launch the Vite React application:
```bash
npm run dev --prefix frontend
```
Open [http://localhost:5173](http://localhost:5173) in your browser. Ensure your MetaMask wallet is connected to the Localhost 8545 network.