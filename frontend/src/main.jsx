import React from "react";
import ReactDOM from "react-dom/client";

import { WagmiProvider } from "wagmi";
import { hardhat, sepolia, mainnet, polygonMumbai } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import { AuthProvider } from "./context/AuthContext";
import App from "./App.jsx";
import "./index.css";

// ── Wagmi + RainbowKit config (hardhat first for local node deployment) ──
const config = getDefaultConfig({
  appName: "Card Nexus",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID",
  chains: [hardhat, sepolia, mainnet, polygonMumbai],
});

const queryClient = new QueryClient();

// ── Custom RainbowKit theme ──
const cardNexusTheme = darkTheme({
  accentColor: "#d4a017",
  accentColorForeground: "#0d0d0d",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={cardNexusTheme}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);