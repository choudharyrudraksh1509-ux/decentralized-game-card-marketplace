import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatEther, parseEther } from 'viem';
import Card from './Card';
import ABI from '../abi/GameCardMarketplace.json';
import { CONTRACT_ADDRESS, isContractConfigured } from '../hooks/useMarketplace';
import { releaseCopyright } from '../api/auth';

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

export default function MyCollection() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const [operatingId, setOperatingId] = useState(null);
  const [operationState, setOperationState] = useState(""); // 'approving', 'listing', 'canceling', 'burning'

  // 1. Fetch balance (staleTime 60s)
  const { data: balanceData, isLoading: isBalanceLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "balanceOf",
    args: [address],
    query: { 
      enabled: !!address && isContractConfigured(),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  });

  const balance = Number(balanceData || 0n);

  const indices = useMemo(() => {
    // Bound the maximum balance to prevent memory allocation freezes if balance is erroneously huge
    const maxBalance = Math.min(Math.max(0, balance), 1000);
    return Array.from({ length: maxBalance }, (_, i) => BigInt(i));
  }, [balance]);

  const indexContracts = useMemo(() => {
    return indices.map(i => ({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "tokenOfOwnerByIndex",
      args: [address, i]
    }));
  }, [indices, address]);

  // 2. Fetch token IDs for each index
  const { data: tokenIdsData, isLoading: isTokenIdsLoading } = useReadContracts({
    contracts: indexContracts,
    query: { 
      enabled: balance > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  });

  const tokenIds = useMemo(() => {
    return tokenIdsData?.map(d => d.result).filter(res => res !== undefined) || [];
  }, [tokenIdsData]);

  const multicallContracts = useMemo(() => {
    return tokenIds.flatMap(id => [
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "tokenURI", args: [id] },
      { address: CONTRACT_ADDRESS, abi: ABI, functionName: "getListing", args: [id] }
    ]);
  }, [tokenIds]);

  // 3. Fetch token URIs AND listing states
  const { data: multicallData, isLoading: isMulticallLoading } = useReadContracts({
    contracts: multicallContracts,
    query: { 
      enabled: tokenIds.length > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  });

  const tokens = useMemo(() => {
    const list = [];
    if (multicallData) {
      for (let i = 0; i < tokenIds.length; i++) {
        const uriResult = multicallData[i * 2]?.result;
        const listingResult = multicallData[i * 2 + 1]?.result;
        if (uriResult) {
          list.push({
            id: tokenIds[i],
            uri: uriResult,
            listing: listingResult
          });
        }
      }
    }
    return list;
  }, [multicallData, tokenIds]);

  const tokenUrisKey = useMemo(() => tokens.map(t => t.uri).join("-"), [tokens]);

  // 4. Fetch JSON metadata from IPFS
  const { data: metadataCache, isLoading: isMetadataLoading } = useQuery({
    queryKey: ["my-collection-metadata-cache", tokenUrisKey],
    queryFn: async () => {
      const promises = tokens.map(async (item) => {
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
    enabled: tokens.length > 0,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  const cards = useMemo(() => {
    return tokens.map(t => ({
      ...t,
      metadata: metadataCache?.[t.uri] || null
    }));
  }, [tokens, metadataCache]);

  // 5. Actions: List, Cancel, Burn
  const { writeContractAsync } = useWriteContract();

  const { refetch: refetchApproval } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: "isApprovedForAll",
    args: [address, CONTRACT_ADDRESS],
    query: { enabled: !!address && isContractConfigured() }
  });

  const handleList = async (tokenId, priceStr) => {
    try {
      setOperatingId(tokenId);
      
      const { data: isApproved } = await refetchApproval();
      let currentlyApproved = isApproved;

      if (!currentlyApproved) {
        setOperationState("approving");
        const hash = await writeContractAsync({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: "setApprovalForAll",
          args: [CONTRACT_ADDRESS, true],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await refetchApproval();
      }

      setOperationState("listing");
      const priceWei = parseEther(priceStr);
      const listHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "listCard",
        args: [BigInt(tokenId), priceWei],
        gas: 300000n,
      });
      
      await publicClient.waitForTransactionReceipt({ hash: listHash });
      
      setOperatingId(null);
      setOperationState("");
      queryClient.invalidateQueries(); 

    } catch (error) {
      console.error("Listing/Update failed:", error);
      setOperatingId(null);
      setOperationState("");
    }
  };

  const handleCancel = async (tokenId) => {
    try {
      setOperatingId(tokenId);
      setOperationState("canceling");
      
      const cancelHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "cancelListing",
        args: [BigInt(tokenId)],
      });
      
      await publicClient.waitForTransactionReceipt({ hash: cancelHash });
      
      setOperatingId(null);
      setOperationState("");
      queryClient.invalidateQueries();

    } catch (error) {
      console.error("Cancellation failed:", error);
      setOperatingId(null);
      setOperationState("");
    }
  };

  const handleBurn = async (tokenId) => {
    try {
      setOperatingId(tokenId);
      setOperationState("burning");
      
      const burnHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "burnCard",
        args: [BigInt(tokenId)],
        gas: 300000n,
      });
      
      await publicClient.waitForTransactionReceipt({ hash: burnHash });
      
      try {
        await releaseCopyright(tokenId);
      } catch (e) {
        console.error("Failed to release copyright in backend DB:", e);
      }

      setOperatingId(null);
      setOperationState("");
      queryClient.invalidateQueries(); 

    } catch (error) {
      console.error("Burn failed:", error);
      setOperatingId(null);
      setOperationState("");
    }
  };

  const isInitialLoading = (isBalanceLoading || isTokenIdsLoading || isMulticallLoading || isMetadataLoading) && balance > 0 && cards.length === 0;

  if (!isContractConfigured()) return null;

  return (
    <section id="my-cards" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-gold/10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-display text-3xl font-bold text-ivory uppercase tracking-widest">
            My Collection
          </h2>
          <p className="text-muted text-sm mt-1">Cards currently in your wallet.</p>
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
      ) : cards && cards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {cards.map((card) => {
            const rarity = card.metadata?.attributes?.find(a => a.trait_type === "Rarity")?.value || "Common";
            const imageUrl = resolveIpfs(card.metadata?.image);
            
            const isListed = card.listing && card.listing[2];
            const badgeText = isListed ? "Currently Listed" : "Owned by you";
            const priceStr = isListed ? formatEther(card.listing[1]) : undefined;
            
            let listText = isListed ? "Update Price" : "List Card";
            let cancelText = "Cancel Listing";

            if (operatingId === card.id) {
              if (operationState === "approving") listText = "Approving...";
              if (operationState === "listing") listText = isListed ? "Updating..." : "Listing...";
              if (operationState === "canceling") cancelText = "Canceling...";
            }

            return (
              <Card 
                key={card.id.toString()}
                id={card.id}
                image={imageUrl}
                name={card.metadata?.name || `Card #${card.id.toString()}`}
                rarity={rarity}
                description={card.metadata?.description}
                badgeText={badgeText}
                price={priceStr}
                isListed={isListed}
                onList={(price) => handleList(card.id, price)}
                listDisabled={operatingId !== null}
                listText={listText}
                onCancel={isListed ? () => handleCancel(card.id) : undefined}
                cancelDisabled={operatingId !== null}
                cancelText={cancelText}
                onBurn={() => handleBurn(card.id)}
                burnDisabled={operatingId !== null}
                burnText={
                  operatingId === card.id && operationState === "burning"
                    ? "Deleting..."
                    : "Delete Card"
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="card-tile p-12 text-center max-w-xl mx-auto my-8">
          <div className="text-4xl mb-3" aria-hidden="true">🛡️</div>
          <h3 className="font-display text-lg font-bold text-ivory uppercase tracking-wider mb-1">
            Your Inventory is Empty
          </h3>
          <p className="text-muted text-sm max-w-md mx-auto mb-6">
            You don't own any cards yet. Mint your first card or purchase one from the marketplace!
          </p>
          <a href="#mint" className="btn-primary inline-block py-2.5 px-6 font-bold uppercase tracking-wider text-xs">
            Mint a Card Now
          </a>
        </div>
      )}
    </section>
  );
}