import React from "react";
import ReactDOM from "react-dom/client";

import { WagmiProvider } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

import App from "./App.jsx";
import "./index.css";

// ── Wagmi + RainbowKit config ─────────────────────────────
const config = getDefaultConfig({
  appName: "Card Nexus",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID",
  chains: [mainnet, sepolia],
});

const queryClient = new QueryClient();

// ── Custom RainbowKit theme (warm — no blues/greens/purples) ─
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
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);