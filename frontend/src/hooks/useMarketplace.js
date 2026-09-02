/**
 * useMarketplace.js
 * Wagmi v2 hooks pre-configured for the GameCardMarketplace contract.
 * The contract address is read from VITE_CONTRACT_ADDRESS in .env.
 */
import { useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi";
import { decodeEventLog } from "viem";
import { useState, useEffect } from "react";
import ABI from "../abi/GameCardMarketplace.json";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";

/** Return true when the address env var looks like a valid hex address. */
export function isContractConfigured() {
  return /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
}

/**
 * Parse a CardMinted event from a transaction receipt's logs.
 * Returns { tokenId: bigint, owner: string, tokenURI: string } or null.
 */
export function parseMintedEvent(receipt) {
  if (!receipt?.logs) return null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({ abi: ABI, ...log });
      if (decoded.eventName === "CardMinted") {
        return {
          tokenId:  decoded.args.tokenId,
          owner:    decoded.args.owner,
          tokenURI: decoded.args.tokenURI,
        };
      }
    } catch { /* log from a different contract */ }
  }
  return null;
}

/**
 * Hook that wraps mintCard() with status tracking.
 * Returns { mintCard, stage, txHash, tokenId, error, reset }
 */
export function useMintCard() {
  const { writeContractAsync, isPending: isWalletPending } = useWriteContract();

  const [stage,   setStage]   = useState("idle");
  const [txHash,  setTxHash]  = useState(null);
  const [tokenId, setTokenId] = useState(null);
  const [error,   setError]   = useState(null);

  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: Boolean(txHash) },
  });

  // When receipt arrives, parse the CardMinted event
  useEffect(() => {
    if (!receipt) return;
    const minted = parseMintedEvent(receipt);
    if (minted) {
      setTokenId(minted.tokenId);
      setStage("success");
    } else {
      setStage("error");
      setError("Transaction confirmed but CardMinted event not found.");
    }
  }, [receipt]);

  const mintCard = async (metadataURI, contentHash) => {
    if (!isContractConfigured()) {
      setError("VITE_CONTRACT_ADDRESS is not set. Add it to frontend/.env");
      setStage("error");
      throw new Error("VITE_CONTRACT_ADDRESS is not set.");
    }

    setError(null);
    setTokenId(null);
    setTxHash(null);

    try {
      setStage("confirm-tx");
      const hash = await writeContractAsync({
        address:      CONTRACT_ADDRESS,
        abi:          ABI,
        functionName: "mintCardWithHash",
        args:         [metadataURI, contentHash],
        gas:          500000n,
      });
      setTxHash(hash);
      setStage("pending-tx");
      return hash;
    } catch (err) {
      const msg = err?.shortMessage ?? err?.message ?? "Transaction rejected or failed.";
      setError(msg);
      setStage("error");
      throw err;
    }
  };

  const reset = () => {
    setStage("idle");
    setTxHash(null);
    setTokenId(null);
    setError(null);
  };

  return {
    mintCard,
    stage,
    txHash,
    tokenId,
    error,
    reset,
    isWalletPending,
    isConfirming,
  };
}