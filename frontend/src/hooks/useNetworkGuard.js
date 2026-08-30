/**
 * useNetworkGuard.js
 *
 * Returns network state relative to a target chain, plus a one-call helper
 * that tries wagmi's useSwitchChain first, then falls back to the raw
 * wallet_switchEthereumChain / wallet_addEthereumChain RPC if needed.
 */
import { useChainId, useSwitchChain } from "wagmi";
import { useCallback, useState } from "react";

/** Polygon Mumbai – change to 80002 (Amoy) for newer Polygon testnet. */
export const MUMBAI_CHAIN_ID = 80001;

export const MUMBAI_CHAIN_PARAMS = {
  chainId:          "0x13881",          // 80001 in hex
  chainName:        "Polygon Mumbai",
  nativeCurrency:   { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls:          ["https://rpc-mumbai.maticvigil.com"],
  blockExplorerUrls:["https://mumbai.polygonscan.com"],
};

export function useNetworkGuard(targetChainId = MUMBAI_CHAIN_ID) {
  const currentChainId          = useChainId();
  const { switchChain, error: switchError } = useSwitchChain();
  const [switching, setSwitching] = useState(false);
  const [localError, setLocalError] = useState(null);

  const isCorrectNetwork = currentChainId === targetChainId;

  /**
   * Try to switch network.
   * 1. Use wagmi's switchChain (handles most wallets cleanly).
   * 2. If that is unsupported, fall back to raw RPC calls so MetaMask
   *    can add/switch the chain without needing wagmi to know about it.
   */
  const switchToTarget = useCallback(async () => {
    setLocalError(null);
    setSwitching(true);
    try {
      // wagmi v2 switchChain
      await switchChain({ chainId: targetChainId });
    } catch (wagmiErr) {
      // wagmi couldn't switch — try raw provider call
      try {
        const provider = window.ethereum;
        if (!provider) throw new Error("No injected provider found.");
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: MUMBAI_CHAIN_PARAMS.chainId }],
          });
        } catch (switchErr) {
          // Error code 4902 = chain not added in wallet yet
          if (switchErr.code === 4902) {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [MUMBAI_CHAIN_PARAMS],
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
    error: localError ?? switchError?.message ?? null,
  };
}