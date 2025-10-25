import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import BidsModal from './BidsModal';

interface BidRecord {
  intentId: string;
  bidder: string;
  amount: string;
  timestamp: string;
  token?: string;
  sourceChain?: string;
}

interface AggregatedBid {
  bidder: string;
  amount: string;
  timestamp: string;
  intentId: string;
  chains: string[]; // Array of chains where this user has bid
  bidCount: number; // Number of bids from this user
}

export default function LiveBidLeaderboard({ auctionId }: { auctionId: string }) {
  const { address } = useAccount();
  const [topBid, setTopBid] = useState<AggregatedBid | null>(null);
  const [totalBidders, setTotalBidders] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const BASE = process.env.NEXT_PUBLIC_KEEPER_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout | null = null;

    async function poll() {
      try {
        const r = await fetch(`${BASE}/api/bids/${auctionId}`);
        const j = await r.json();
        if (!j.success || !mounted) return;
        
        const bids: BidRecord[] = j.data || [];
        
        // Aggregate bids by bidder address
        const bidderMap = new Map<string, { 
          bidder: string; 
          amount: bigint; 
          timestamp: string; 
          intentId: string;
          chains: Set<string>;
          bidCount: number;
        }>();
        
        bids.forEach(bid => {
          const bidderKey = bid.bidder.toLowerCase();
          const existing = bidderMap.get(bidderKey);
          
          if (existing) {
            existing.amount += BigInt(bid.amount);
            if (bid.sourceChain) {
              existing.chains.add(bid.sourceChain);
            }
            existing.bidCount += 1;
            if (parseInt(bid.timestamp) > parseInt(existing.timestamp)) {
              existing.timestamp = bid.timestamp;
            }
          } else {
            const chains = new Set<string>();
            if (bid.sourceChain) {
              chains.add(bid.sourceChain);
            }
            bidderMap.set(bidderKey, {
              bidder: bid.bidder,
              amount: BigInt(bid.amount),
              timestamp: bid.timestamp,
              intentId: bid.intentId,
              chains: chains,
              bidCount: 1
            });
          }
        });
        
        // Convert to array and sort
        const aggregatedBids: AggregatedBid[] = Array.from(bidderMap.values()).map(b => ({
          bidder: b.bidder,
          amount: b.amount.toString(),
          timestamp: b.timestamp,
          intentId: b.intentId,
          chains: Array.from(b.chains),
          bidCount: b.bidCount
        }));
        
        const sorted = aggregatedBids.sort((a, b) => {
          try { return BigInt(b.amount) > BigInt(a.amount) ? 1 : -1; }
          catch { return 0; }
        });

        setTotalBidders(sorted.length);
        setTopBid(sorted[0] || null);
      } catch (e) {
        console.error('LiveBidLeaderboard poll error:', e);
      } finally {
        if (mounted) {
          timer = setTimeout(poll, 3000);
        }
      }
    }

    poll();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [auctionId, address, BASE]);

  return (
    <>
      {/* Compact one-line display */}
      <div 
        onClick={() => setIsModalOpen(true)}
        className="flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 cursor-pointer transition-all group"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-green-400">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
            Live
          </span>
          <span className="text-white/50">•</span>
          <span className="text-white/70">
            {totalBidders} {totalBidders === 1 ? 'bid' : 'bids'}
          </span>
          {topBid && (
            <>
              <span className="text-white/50">•</span>
              <span className="text-white font-mono font-semibold">
                ${ethers.formatUnits(topBid.amount, 6)}
              </span>
            </>
          )}
        </div>
        <svg 
          className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Bids Modal */}
      <BidsModal 
        auctionId={auctionId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}