/**
 * useNetworkGuard.js
 *
 * Returns network state relative to a target chain, plus a one-call helper
 * that tries wagmi's useSwitchChain first, then falls back to the raw
 * wallet_switchEthereumChain / wallet_addEthereumChain RPC if needed.
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

export const TARGET_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || "31337", 10);
export const TARGET_CHAIN_PARAMS = NETWORKS[TARGET_CHAIN_ID] || NETWORKS[31337];

// Backwards compatibility alias for WalletConnector
export const MUMBAI_CHAIN_ID = TARGET_CHAIN_ID;
export const MUMBAI_CHAIN_PARAMS = TARGET_CHAIN_PARAMS;

export function useNetworkGuard(targetChainId = TARGET_CHAIN_ID) {
  const currentChainId = useChainId();
  const { switchChain, error: switchError } = useSwitchChain();
  const [switching, setSwitching] = useState(false);
  const [localError, setLocalError] = useState(null);

  const isCorrectNetwork = currentChainId === targetChainId;

  const switchToTarget = useCallback(async () => {
    const params = NETWORKS[targetChainId];
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
    targetChainName: TARGET_CHAIN_PARAMS.chainName,
    error: localError ?? switchError?.message ?? null,
  };
}