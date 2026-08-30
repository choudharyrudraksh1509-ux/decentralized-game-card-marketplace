/**
 * useMarketplace.js
 * Wagmi v2 hooks pre-configured for the GameCardMarketplace contract.
 * The contract address is read from VITE_CONTRACT_ADDRESS in .env.
 */
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
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
 *
 * Stage progression:
 *   idle → confirm-tx → pending-tx → success | error
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

  const mintCard = async (metadataURI) => {
    if (!isContractConfigured()) {
      setError("VITE_CONTRACT_ADDRESS is not set. Add it to frontend/.env");
      setStage("error");
      return;
    }

    setError(null);
    setTokenId(null);
    setTxHash(null);

    try {
      setStage("confirm-tx");
      const hash = await writeContractAsync({
        address:      CONTRACT_ADDRESS,
        abi:          ABI,
        functionName: "mintCard",
        args:         [metadataURI],
      });
      setTxHash(hash);
      setStage("pending-tx");
    } catch (err) {
      const msg = err?.shortMessage ?? err?.message ?? "Transaction rejected.";
      setError(msg);
      setStage("error");
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