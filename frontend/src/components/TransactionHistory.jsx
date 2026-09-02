import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatEther, createPublicClient, http } from 'viem';
import { hardhat, polygonMumbai, polygonAmoy } from 'wagmi/chains';
import ABI from '../abi/GameCardMarketplace.json';
import { CONTRACT_ADDRESS, isContractConfigured } from '../hooks/useMarketplace';

function shortAddr(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ── Static Viem client for the target chain (prevents querying Mainnet on load) ──
const getTargetChain = () => {
  const chainId = Number(import.meta.env.VITE_CHAIN_ID || 31337);
  if (chainId === 31337) return hardhat;
  if (chainId === 80002) return polygonAmoy;
  return polygonMumbai;
};

const getTargetRpc = () => {
  const chainId = Number(import.meta.env.VITE_CHAIN_ID || 31337);
  if (chainId === 31337) return "http://127.0.0.1:8545";
  if (chainId === 80002) return "https://rpc-amoy.polygon.technology";
  return "https://rpc-mumbai.maticvigil.com";
};

const staticClient = createPublicClient({
  chain: getTargetChain(),
  transport: http(getTargetRpc())
});

export default function TransactionHistory() {
  const queryClient = useQueryClient();

  const { data: logs, refetch, isLoading, isError } = useQuery({
    queryKey: ['contract-events'],
    queryFn: async () => {
      try {
        const events = await staticClient.getContractEvents({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          fromBlock: 0n,
        });
        
        // Sort descending (newest first) by block number / log index
        return events.sort((a, b) => {
          if (b.blockNumber !== a.blockNumber) {
            return Number(b.blockNumber - a.blockNumber);
          }
          return Number(b.logIndex - a.logIndex);
        });
      } catch (err) {
        console.error("Failed to query events:", err);
        return [];
      }
    },
    enabled: isContractConfigured(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (!isContractConfigured()) return null;

  return (
    <section id="history" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-display text-3xl font-bold text-ivory uppercase tracking-widest">
            History
          </h2>
          <p className="text-muted text-sm mt-1">Live smart contract events.</p>
        </div>
      </div>

      <div className="card-tile p-6 max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-8 text-gold animate-pulse text-sm font-semibold">Loading events...</div>
        ) : isError ? (
          <div className="text-crimson-light p-4 text-center text-sm font-semibold">Failed to load history.</div>
        ) : logs && logs.length > 0 ? (
          <div className="flex flex-col gap-4">
            {logs.map((log) => {
              const { eventName, args, transactionHash, logIndex } = log;
              let description = "";
              let icon = "⚡";

              if (eventName === "CardMinted") {
                icon = "✨";
                description = (
                  <span>
                    Card <strong className="text-ivory">#{args.tokenId?.toString()}</strong> was minted by <span className="font-mono text-gold">{shortAddr(args.owner)}</span>
                  </span>
                );
              } else if (eventName === "CardListed") {
                icon = "🏷️";
                description = (
                  <span>
                    Card <strong className="text-ivory">#{args.tokenId?.toString()}</strong> was listed by <span className="font-mono text-gold">{shortAddr(args.seller)}</span> for <strong className="text-parchment">{formatEther(args.price || 0n)} MATIC</strong>
                  </span>
                );
              } else if (eventName === "CardSale") {
                icon = "🤝";
                description = (
                  <span>
                    Card <strong className="text-ivory">#{args.tokenId?.toString()}</strong> was purchased by <span className="font-mono text-gold">{shortAddr(args.buyer)}</span> from <span className="font-mono text-muted">{shortAddr(args.seller)}</span> for <strong className="text-parchment">{formatEther(args.price || 0n)} MATIC</strong>
                  </span>
                );
              } else if (eventName === "ListingCancelled") {
                icon = "❌";
                description = (
                  <span>
                    Listing for Card <strong className="text-ivory">#{args.tokenId?.toString()}</strong> was cancelled by <span className="font-mono text-gold">{shortAddr(args.seller)}</span>
                  </span>
                );
              } else if (eventName === "CardBurned") {
                icon = "🔥";
                description = (
                  <span>
                    Card <strong className="text-ivory">#{args.tokenId?.toString()}</strong> was burned/deleted by <span className="font-mono text-gold">{shortAddr(args.owner)}</span>
                  </span>
                );
              }

              // Filter out standard ERC721 events (Transfer, Approval) to keep the history feed strictly focused on marketplace mechanics
              if (!["CardMinted", "CardListed", "CardSale", "ListingCancelled", "CardBurned"].includes(eventName)) {
                 return null;
              }

              return (
                <div key={`${transactionHash}-${logIndex}`} className="flex items-start gap-4 p-4 rounded-xl bg-obsidian border border-ash hover:border-gold/30 transition-colors">
                  <div className="text-2xl mt-1 select-none">{icon}</div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-muted leading-relaxed">
                      {description}
                    </p>
                    <a 
                      href={`https://amoy.polygonscan.com/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-gold/60 font-mono hover:text-gold hover:underline w-fit"
                    >
                      Tx: {shortAddr(transactionHash)} ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted text-sm">No marketplace events found.</div>
        )}
      </div>
    </section>
  );
}