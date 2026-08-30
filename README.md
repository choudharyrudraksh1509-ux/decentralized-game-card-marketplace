# 🎴 Decentralized Game Card Marketplace

A fully decentralized application (dApp) for minting, buying, and selling digital game cards as ERC-721 NFTs on Polygon.

---

## Development Walk-through

Follow these steps to set up, test, and deploy the project locally:

### 1. Install dependencies
Install the root dependencies for the Hardhat environment:
\\\ash
npm install
\\\
*(Make sure to also run 
pm install inside the rontend/ and ackend/ directories to install their respective dependencies.)*

### 2. Run tests
Execute the smart contract test suite (using Hardhat and Chai) to ensure all marketplace logic is functioning correctly:
\\\ash
npx hardhat test
\\\

### 3. Deploy to Mumbai
Ensure your .env file is properly configured with your API keys and wallet private key. Then, deploy the contract to the Polygon Mumbai testnet:
\\\ash
npx hardhat run scripts/deploy.js --network mumbai
\\\
*(Remember to copy the deployed contract address to your rontend/.env file!)*

### 4. Start front-end
Start the Vite development server to view the application:
\\\ash
cd frontend
npm run dev
\\\
*(Note: You will also need to start the backend IPFS bridge by running 
pm run dev in the ackend/ directory).*

---

## Screenshots

> *(Placeholder: Add screenshots of the application below)*

- **Marketplace Gallery**: [Insert screenshot here]
- **Mint Card Form**: [Insert screenshot here]
- **My Collection**: [Insert screenshot here]

---

## Deployed Application

- **Live Demo URL**: [Insert Deployed Front-end URL Here]
- **Smart Contract (Polygonscan)**: [Insert Polygonscan Link Here]