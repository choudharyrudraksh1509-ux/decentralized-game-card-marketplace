/**
 * useNetworkGuard.js
 *
 * Returns network state relative to supported chains (Sepolia, Hardhat Localhost, Polygon, Mainnet).
 */
import { useChainId, useSwitchChain } from "wagmi";
import { useCallback, useState } from "react";

export const NETWORKS = {
  31337: {
    chainId: "0x7a69", // 31337 in hex
    chainName: "Hardhat Localhost",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["http://127.0.0.1:8545"],
    blockExplorerUrls: [],
  },
  11155111: {
    chainId: "0xaa36a7", // 11155111 in hex
    chainName: "Sepolia Testnet",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
  80002: {
    chainId: "0x13882", // 80002 in hex
    chainName: "Polygon Amoy",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    blockExplorerUrls: ["https://amoy.polygonscan.com"],
  },
  80001: {
    chainId: "0x13881", // 80001 in hex
    chainName: "Polygon Mumbai",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://rpc-mumbai.maticvigil.com"],
    blockExplorerUrls: ["https://mumbai.polygonscan.com"],
  }
};

export const ALLOWED_CHAIN_IDS = [31337, 11155111, 80002, 80001, 1, 137];
export const TARGET_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || "11155111", 10);
export const TARGET_CHAIN_PARAMS = NETWORKS[TARGET_CHAIN_ID] || NETWORKS[11155111] || NETWORKS[31337];

export const MUMBAI_CHAIN_ID = TARGET_CHAIN_ID;
export const MUMBAI_CHAIN_PARAMS = TARGET_CHAIN_PARAMS;

export function useNetworkGuard(targetChainId = TARGET_CHAIN_ID) {
  const currentChainId = useChainId();
  const { switchChain, error: switchError } = useSwitchChain();
  const [switching, setSwitching] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Accept current chain if it is any of our supported chains (Sepolia, Hardhat, etc.)
  const isCorrectNetwork = ALLOWED_CHAIN_IDS.includes(currentChainId);
  const activeParams = NETWORKS[currentChainId] || NETWORKS[targetChainId] || NETWORKS[11155111];

  const switchToTarget = useCallback(async () => {
    const params = NETWORKS[targetChainId] || NETWORKS[11155111];
    if (!params) {
       setLocalError(`Configuration for chain ID ${targetChainId} not found.`);
       return;
    }

    setLocalError(null);
    setSwitching(true);
    try {
      await switchChain({ chainId: targetChainId });
    } catch (wagmiErr) {
      try {
        const provider = window.ethereum;
        if (!provider) throw new Error("No injected provider found.");
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: params.chainId }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [params],
            });
          } else {
            throw switchErr;
          }
        }
      } catch (fallbackErr) {
        setLocalError(fallbackErr.message ?? "Failed to switch network.");
      }
    } finally {
      setSwitching(false);
    }
  }, [switchChain, targetChainId]);

  return {
    currentChainId,
    isCorrectNetwork,
    switching,
    switchToTarget,
    targetChainName: activeParams?.chainName || "Supported Network",
    error: localError ?? switchError?.message ?? null,
  };
}