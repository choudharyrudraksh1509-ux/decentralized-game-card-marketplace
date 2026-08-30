import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useQuery } from "@tanstack/react-query";
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

  // 3. Fetch token URIs
  const { data: urisData, isLoading: isUrisLoading } = useReadContracts({
    contracts: tokenIds.map(id => ({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: "tokenURI",
      args: [id]
    })),
    query: { enabled: tokenIds.length > 0 }
  });

  const tokens = tokenIds.map((id, index) => ({
    id,
    uri: urisData?.[index]?.result
  })).filter(t => t.uri);

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

  const isLoading = isBalanceLoading || isTokenIdsLoading || isUrisLoading || isMetadataLoading;

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

            return (
              <Card 
                key={card.id.toString()}
                id={card.id}
                image={imageUrl}
                name={card.metadata?.name}
                rarity={rarity}
                description={card.metadata?.description}
                badgeText="Owned by you"
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