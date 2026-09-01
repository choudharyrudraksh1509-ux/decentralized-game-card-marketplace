import { useState, useEffect } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatEther } from "viem";
import ABI from "../abi/GameCardMarketplace.json";
import { CONTRACT_ADDRESS, isContractConfigured } from "../hooks/useMarketplace";

import Card from "./Card";

/** Converts ipfs:// URLs to an HTTP gateway or local mock server */
function resolveIpfs(url) {
  if (!url) return "";
  if (url.startsWith("ipfs://")) {
    const pathPart = url.replace("ipfs://", "");
    if (pathPart.includes("MockImageHash")) {
      return `http://localhost:5000/images/${pathPart}`;
    }
    if (pathPart.includes("MockMetaHash")) {
      return `http://localhost:5000/metadata/${pathPart}`;
    }
    return url.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  return url;
}

const RARITY_STYLES = {
  Common:    "badge-ash",
  Uncommon:  "badge-ash",
  Rare:      "badge-amber",
  Epic:      "badge-crimson",
  Legendary: "badge-gold",
};

export default function MarketplaceGallery() {
  const { address: userAddress } = useAccount();
  const queryClient = useQueryClient();
  const [buyingId, setBuyingId] = useState(null);
  
  // 1. Fetch nextTokenId to know how many tokens exist
  const { data: nextTokenIdRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "nextTokenId",
    query: { enabled: isContractConfigured() }
  });

  const nextTokenId = Number(nextTokenIdRaw ?? 1n);
  // Generate array of token IDs [1, 2, ..., nextTokenId - 1]
  const tokenIds = Array.from({ length: Math.max(0, nextTokenId - 1) }, (_, i) => BigInt(i + 1));

  // 2. Fetch listings and URIs for all tokens in parallel using useReadContracts
  const { data: multicallData, refetch: refetchMulticall, isLoading: isMulticallLoading } = useReadContracts({
    contracts: tokenIds.flatMap(id => [
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "getListing", args: [id] },
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "tokenURI", args: [id] }
    ]),
    query: { enabled: tokenIds.length > 0 }
  });

  // Parse multicall results to find active listings
  const activeListings = [];
  if (multicallData) {
    for (let i = 0; i < tokenIds.length; i++) {
      const listingResult = multicallData[i * 2]?.result;
      const uriResult = multicallData[i * 2 + 1]?.result;
      
      // listingResult is [seller, price, isListed]
      if (listingResult && listingResult[2] === true) {
        activeListings.push({
          id: tokenIds[i],
          seller: listingResult[0],
          price: listingResult[1], // bigint in wei
          uri: uriResult
        });
      }
    }
  }

  // 3. Fetch JSON metadata from IPFS for active listings (Decoupled cache)
  const { data: metadataCache, isLoading: isMetadataLoading } = useQuery({
    queryKey: ["metadata-cache", activeListings.map(l => l.uri).join("-")],
    queryFn: async () => {
      const promises = activeListings.map(async (item) => {
        try {
          const httpUrl = resolveIpfs(item.uri);
          const res = await fetch(httpUrl);
          const metadata = await res.json();
          return { uri: item.uri, metadata };
        } catch (err) {
          console.error("Failed to fetch metadata for", item.uri, err);
          return {
            uri: item.uri,
            metadata: {
              name: `Card #${item.id.toString()}`,
              description: "A legendary on-chain game card minted during local testing.",
              image: "ipfs://QmMockImageHash_default",
              attributes: [{ trait_type: "Rarity", value: "Legendary" }]
            }
          };
        }
      });
      const results = await Promise.all(promises);
      return results.reduce((acc, curr) => {
        acc[curr.uri] = curr.metadata;
        return acc;
      }, {});
    },
    enabled: activeListings.length > 0
  });

  // Merge dynamic blockchain listing data with static IPFS metadata cache
  const cards = activeListings.map(item => ({
    ...item,
    metadata: metadataCache?.[item.uri] || null
  }));

  // 4. Buying logic
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const [txHash, setTxHash] = useState(null);
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: Boolean(txHash) }
  });

  useEffect(() => {
    if (isConfirmed) {
      setBuyingId(null);
      setTxHash(null);
      queryClient.invalidateQueries(); // Invalidate and reload all blockchain/metadata queries
    }
  }, [isConfirmed, queryClient]);

  const handleBuy = async (id, price) => {
    try {
      setBuyingId(id);
      setTxHash(null);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "buyCard",
        args: [BigInt(id)],
        value: price,
        chainId: 31337,
        gas: 300000n,
      });
      setTxHash(hash);
    } catch (err) {
      console.error("Buy failed:", err);
      setBuyingId(null);
    }
  };

  const isLoading = isMulticallLoading || isMetadataLoading;

  if (!isContractConfigured()) {
    return (
      <div className="card-tile p-8 text-center max-w-2xl mx-auto mt-8">
        <p className="text-crimson-light font-semibold mb-2">Marketplace Unavailable</p>
        <p className="text-muted text-sm">Contract address not configured in frontend/.env.</p>
      </div>
    );
  }

  return (
    <section id="marketplace" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-display text-3xl font-bold text-ivory uppercase tracking-widest">
            Live Market
          </h2>
          <p className="text-muted text-sm mt-1">Discover and collect unique cards.</p>
        </div>
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
            const isOwner = userAddress?.toLowerCase() === card.seller.toLowerCase();
            const isBuyingThis = buyingId === card.id;
            const isProcessing = isBuyingThis && (isWritePending || isConfirming);
            
            // Extract attributes from metadata
            const rarity = card.metadata?.attributes?.find(a => a.trait_type === "Rarity")?.value || "Common";
            const imageUrl = resolveIpfs(card.metadata?.image);

            return (
              <Card
                key={card.id.toString()}
                id={card.id}
                image={imageUrl}
                name={card.metadata?.name}
                rarity={rarity}
                description={card.metadata?.description}
                price={formatEther(card.price)}
                badgeText={`Seller: ${card.seller.slice(0, 6)}…${card.seller.slice(-4)}`}
                onBuy={() => handleBuy(card.id, card.price)}
                buyDisabled={isOwner || buyingId !== null || !userAddress}
                buyText={isProcessing ? "Processing..." : isOwner ? "Owned" : !userAddress ? "Connect" : "Buy"}
              />
            );
          })}
        </div>
      ) : (
        <div className="card-tile p-12 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4 opacity-50" aria-hidden>🏜️</span>
          <h3 className="text-xl font-display font-bold text-ivory mb-2">The market is quiet</h3>
          <p className="text-muted max-w-md">
            There are currently no cards listed for sale. Be the first to mint and list a card!
          </p>
        </div>
      )}
    </section>
  );
}