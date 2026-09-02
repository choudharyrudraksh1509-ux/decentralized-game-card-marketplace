import React, { useState, useEffect, useMemo } from 'react';
import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatEther } from 'viem';
import Card from './Card';
import ABI from '../abi/GameCardMarketplace.json';
import { CONTRACT_ADDRESS, isContractConfigured } from '../hooks/useMarketplace';

/** Resolve IPFS URIs (ipfs://... -> http gateway or mock endpoint) */
function resolveIpfs(uri) {
  if (!uri) return 'https://via.placeholder.com/400x550/1A1F2C/D4A017?text=Card+Image';
  if (uri.startsWith('ipfs://')) {
    const cidStr = uri.replace('ipfs://', '');
    if (cidStr.startsWith('QmMockImageHash_') || cidStr.startsWith('QmMockMetaHash_')) {
      const isMeta = cidStr.startsWith('QmMockMetaHash_');
      const folder = isMeta ? 'metadata' : 'images';
      const backendUrl = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5000';
      return `${backendUrl}/${folder}/${cidStr}`;
    }
    return `https://ipfs.io/ipfs/${cidStr}`;
  }
  return uri;
}

export default function MarketplaceGallery() {
  const queryClient = useQueryClient();
  const [buyingId, setBuyingId] = useState(null);

  // 1. Fetch total nextTokenId count (staleTime 1 minute to prevent polling lag)
  const { data: nextTokenIdRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "nextTokenId",
    query: { 
      enabled: isContractConfigured(),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  });

  const nextTokenId = Number(nextTokenIdRaw ?? 1n);

  // Stable memoized array of token IDs [1, 2, ..., nextTokenId - 1]
  const tokenIds = useMemo(() => {
    // Bound the maximum tokens to prevent memory allocation freezes if nextTokenId is erroneously huge
    const maxTokens = Math.min(Math.max(0, nextTokenId - 1), 1000);
    return Array.from({ length: maxTokens }, (_, i) => BigInt(i + 1));
  }, [nextTokenId]);

  // Memoized contracts parameters to prevent infinite multicall loops
  const multicallContracts = useMemo(() => {
    return tokenIds.flatMap(id => [
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "getListing", args: [id] },
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "tokenURI", args: [id] }
    ]);
  }, [tokenIds]);

  // 2. Fetch listings and URIs for all tokens in parallel using useReadContracts
  const { data: multicallData, isLoading: isMulticallLoading } = useReadContracts({
    contracts: multicallContracts,
    query: { 
      enabled: tokenIds.length > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  });

  // Memoized active listings filtering
  const activeListings = useMemo(() => {
    const listings = [];
    if (multicallData) {
      for (let i = 0; i < tokenIds.length; i++) {
        const listingResult = multicallData[i * 2]?.result;
        const uriResult = multicallData[i * 2 + 1]?.result;
        
        if (listingResult && listingResult[2] === true) {
          listings.push({
            id: tokenIds[i],
            seller: listingResult[0],
            price: listingResult[1],
            uri: uriResult
          });
        }
      }
    }
    return listings;
  }, [multicallData, tokenIds]);

  const activeListingUrisKey = useMemo(() => activeListings.map(l => l.uri).join("-"), [activeListings]);

  // 3. Fetch JSON metadata from IPFS for active listings (Cached)
  const { data: metadataCache, isLoading: isMetadataLoading } = useQuery({
    queryKey: ["metadata-cache", activeListingUrisKey],
    queryFn: async () => {
      const promises = activeListings.map(async (item) => {
        try {
          const httpUrl = resolveIpfs(item.uri);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(httpUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error("Metadata fetch failed");
          const metadata = await res.json();
          return { uri: item.uri, metadata };
        } catch (err) {
          return {
            uri: item.uri,
            metadata: {
              name: `Card #${item.id.toString()}`,
              description: "A legendary on-chain game card.",
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
    enabled: activeListings.length > 0,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  // Merge dynamic blockchain listing data with static IPFS metadata cache
  const cards = useMemo(() => {
    return activeListings.map(item => ({
      ...item,
      metadata: metadataCache?.[item.uri] || null
    }));
  }, [activeListings, metadataCache]);

  // 4. Buying logic
  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState(null);
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
    query: { enabled: Boolean(txHash) }
  });

  useEffect(() => {
    if (isConfirmed) {
      setBuyingId(null);
      setTxHash(null);
      queryClient.invalidateQueries();
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
        gas: 300000n,
      });
      setTxHash(hash);
    } catch (err) {
      console.error("Buy failed:", err);
      setBuyingId(null);
    }
  };

  const isInitialLoading = (isMulticallLoading || isMetadataLoading) && tokenIds.length > 0 && cards.length === 0;

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

      {isInitialLoading ? (
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
      ) : cards.length === 0 ? (
        <div className="card-tile p-12 text-center max-w-xl mx-auto my-8">
          <div className="text-4xl mb-3" aria-hidden="true">🃏</div>
          <h3 className="font-display text-lg font-bold text-ivory uppercase tracking-wider mb-1">
            No Cards Listed Right Now
          </h3>
          <p className="text-muted text-sm max-w-md mx-auto">
            Be the first to mint a unique card and list it for sale!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cards.map((card) => {
            const priceStr = formatEther(card.price);
            const rarity = card.metadata?.attributes?.find(a => a.trait_type === "Rarity")?.value || "Common";
            const imageUrl = resolveIpfs(card.metadata?.image);
            const isBuyingThis = buyingId === card.id;

            return (
              <Card
                key={card.id.toString()}
                id={card.id}
                image={imageUrl}
                name={card.metadata?.name || `Card #${card.id.toString()}`}
                rarity={rarity}
                description={card.metadata?.description}
                price={priceStr}
                badgeText="Available"
                actionText={
                  isBuyingThis 
                    ? (isConfirming ? "Confirming..." : "Processing...") 
                    : "Buy Now"
                }
                actionDisabled={buyingId !== null}
                onAction={() => handleBuy(card.id, card.price)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}