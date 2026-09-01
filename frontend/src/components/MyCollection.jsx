import { useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseEther, formatEther } from "viem";
import ABI from "../abi/GameCardMarketplace.json";
import { CONTRACT_ADDRESS, isContractConfigured } from "../hooks/useMarketplace";
import { releaseCopyright } from "../api/auth";
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

export default function MyCollection() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const [operatingId, setOperatingId] = useState(null);
  const [operationState, setOperationState] = useState(""); // 'approving', 'listing', 'canceling'

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

  // 4. Fetch JSON metadata from IPFS (Decoupled cache)
  const { data: metadataCache, isLoading: isMetadataLoading } = useQuery({
    queryKey: ["my-collection-metadata-cache", tokens.map(t => t.uri).join("-")],
    queryFn: async () => {
      const promises = tokens.map(async (item) => {
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
    enabled: tokens.length > 0
  });

  // Merge dynamic blockchain listing data with static IPFS metadata cache
  const cards = tokens.map(item => ({
    ...item,
    metadata: metadataCache?.[item.uri] || null
  }));

  // 5. Approval, Listing, and Canceling Logic
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
          args: [CONTRACT_ADDRESS, true],
          chainId: 31337,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await refetchApproval();
        currentlyApproved = true;
      }

      // Step 2: List (or update) the card
      setOperationState("listing");
      const priceWei = parseEther(priceStr);
      const listHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "listCard",
        args: [BigInt(tokenId), priceWei],
        chainId: 31337,
        gas: 300000n,
      });
      
      await publicClient.waitForTransactionReceipt({ hash: listHash });
      
      // Success! Refresh local UI state and global query caches
      setOperatingId(null);
      setOperationState("");
      queryClient.invalidateQueries(); 

    } catch (error) {
      console.error("Listing/Update failed:", error);
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
        chainId: 31337,
        gas: 300000n,
      });
      
      await publicClient.waitForTransactionReceipt({ hash: burnHash });
      
      // Release copyright in backend database
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

  const handleCancel = async (tokenId) => {
    try {
      setOperatingId(tokenId);
      setOperationState("canceling");
      
      const cancelHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "cancelListing",
        args: [tokenId]
      });
      
      await publicClient.waitForTransactionReceipt({ hash: cancelHash });
      
      // Success! Refresh local UI state and global query caches
      setOperatingId(null);
      setOperationState("");
      queryClient.invalidateQueries(); 

    } catch (error) {
      console.error("Cancel failed:", error);
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
            
            // Dynamic text based on current transaction states
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
                name={card.metadata?.name}
                rarity={rarity}
                description={card.metadata?.description}
                badgeText={badgeText}
                
                // Existing listing config
                price={priceStr}
                isListed={isListed}
                
                // Listing & Updating config
                onList={(price) => handleList(card.id, price)}
                listDisabled={operatingId !== null}
                listText={listText}
                
                // Canceling config
                onCancel={isListed ? () => handleCancel(card.id) : undefined}
                cancelDisabled={operatingId !== null}
                cancelText={cancelText}

                // Burning config
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