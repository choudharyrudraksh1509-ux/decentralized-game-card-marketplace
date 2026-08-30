import { useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEther, formatEther } from "viem";
import ABI from "../abi/GameCardMarketplace.json";
import { CONTRACT_ADDRESS, isContractConfigured } from "../hooks/useMarketplace";
import Card from "./Card";

function resolveIpfs(url) {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return url;
}

export default function MyCollection() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const [operatingId, setOperatingId] = useState(null);
  const [operationState, setOperationState] = useState(""); // 'approving', 'listing'

  // 1. Fetch balance
  const { data: balanceData, isLoading: isBalanceLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: !!address && isContractConfigured() }
  });

  const balance = Number(balanceData || 0n);
  const indices = Array.from({ length: balance }, (_, i) => BigInt(i));

  // 2. Fetch token IDs for each index
  const { data: tokenIdsData, isLoading: isTokenIdsLoading } = useReadContracts({
    contracts: indices.map(i => ({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "tokenOfOwnerByIndex",
      args: [address, i]
    })),
    query: { enabled: balance > 0 }
  });

  const tokenIds = tokenIdsData?.map(d => d.result).filter(res => res !== undefined) || [];

  // 3. Fetch token URIs AND listing states
  const { data: multicallData, isLoading: isMulticallLoading, refetch: refetchMulticall } = useReadContracts({
    contracts: tokenIds.flatMap(id => [
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "tokenURI", args: [id] },
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "getListing", args: [id] }
    ]),
    query: { enabled: tokenIds.length > 0 }
  });

  const tokens = [];
  if (multicallData) {
    for (let i = 0; i < tokenIds.length; i++) {
      const uriResult = multicallData[i * 2]?.result;
      const listingResult = multicallData[i * 2 + 1]?.result; // [seller, price, isListed]
      if (uriResult) {
        tokens.push({
          id: tokenIds[i],
          uri: uriResult,
          listing: listingResult
        });
      }
    }
  }

  // 4. Fetch JSON metadata from IPFS
  const { data: cards, isLoading: isMetadataLoading } = useQuery({
    queryKey: ["my-collection-metadata", tokens.map(t => t.id.toString()).join("-")],
    queryFn: async () => {
      const promises = tokens.map(async (item) => {
        try {
          const httpUrl = resolveIpfs(item.uri);
          const res = await fetch(httpUrl);
          const metadata = await res.json();
          return { ...item, metadata };
        } catch (err) {
          console.error("Failed to fetch metadata for token", item.id, err);
          return { ...item, metadata: null };
        }
      });
      return Promise.all(promises);
    },
    enabled: tokens.length > 0
  });

  // 5. Approval & Listing Logic
  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "isApprovedForAll",
    args: [address, CONTRACT_ADDRESS],
    query: { enabled: !!address }
  });

  const { writeContractAsync } = useWriteContract();

  const handleList = async (tokenId, priceStr) => {
    try {
      setOperatingId(tokenId);
      
      let currentlyApproved = isApproved;
      
      // Step 1: Approve marketplace if not already approved
      if (!currentlyApproved) {
        setOperationState("approving");
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "setApprovalForAll",
          args: [CONTRACT_ADDRESS, true]
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await refetchApproval();
        currentlyApproved = true;
      }

      // Step 2: List the card
      setOperationState("listing");
      const priceWei = parseEther(priceStr);
      const listHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "listCard",
        args: [tokenId, priceWei]
      });
      
      await publicClient.waitForTransactionReceipt({ hash: listHash });
      
      // Success! Refresh local UI state and global query caches
      setOperatingId(null);
      setOperationState("");
      refetchMulticall(); 
      queryClient.invalidateQueries({ queryKey: ["metadata"] });

    } catch (error) {
      console.error("Listing failed:", error);
      setOperatingId(null);
      setOperationState("");
    }
  };

  const isLoading = isBalanceLoading || isTokenIdsLoading || isMulticallLoading || isMetadataLoading;

  if (!isConnected) {
    return (
      <section id="my-cards" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="card-tile p-12 text-center flex flex-col items-center gap-3">
          <span className="text-4xl" aria-hidden>🔒</span>
          <p className="text-parchment font-semibold">Connect your wallet to view your collection.</p>
        </div>
      </section>
    );
  }

  if (!isContractConfigured()) {
    return null;
  }

  return (
    <section id="my-cards" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold text-ivory uppercase tracking-widest">
          My Collection
        </h2>
        <p className="text-muted text-sm mt-1">Cards currently in your wallet.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card-tile h-[360px] animate-pulse flex flex-col p-4">
              <div className="w-full h-48 bg-charcoal rounded-xl mb-4" />
              <div className="h-5 bg-charcoal rounded w-3/4 mb-2" />
              <div className="h-4 bg-charcoal rounded w-1/2 mb-4" />
              <div className="mt-auto h-10 bg-charcoal rounded-lg w-full" />
            </div>
          ))}
        </div>
      ) : cards && cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cards.map((card) => {
            const rarity = card.metadata?.attributes?.find(a => a.trait_type === "Rarity")?.value || "Common";
            const imageUrl = resolveIpfs(card.metadata?.image);
            
            const isListed = card.listing && card.listing[2]; // listing[2] is boolean isListed
            const badgeText = isListed ? "Currently Listed" : "Owned by you";
            const priceStr = isListed ? formatEther(card.listing[1]) : undefined;

            return (
              <Card 
                key={card.id.toString()}
                id={card.id}
                image={imageUrl}
                name={card.metadata?.name}
                rarity={rarity}
                description={card.metadata?.description}
                badgeText={badgeText}
                
                // Existing listing config
                price={priceStr}
                isListed={isListed}
                
                // New listing config
                onList={(price) => handleList(card.id, price)}
                listDisabled={operatingId !== null}
                listText={
                  operatingId === card.id 
                    ? (operationState === "approving" ? "Approving..." : "Listing...") 
                    : "List Card"
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="card-tile p-12 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4 opacity-50" aria-hidden>🎴</span>
          <h3 className="text-xl font-display font-bold text-ivory mb-2">Your collection is empty</h3>
          <p className="text-muted max-w-md">
            You don't own any cards yet. Head over to the marketplace to buy one, or mint your own!
          </p>
        </div>
      )}
    </section>
  );
}