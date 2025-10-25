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
  const [userBid, setUserBid] = useState<AggregatedBid | null>(null);
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
        
        if (address) {
          const myBid = sorted.find(b => b.bidder.toLowerCase() === address.toLowerCase());
          setUserBid(myBid || null);
        }
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
      <div className="p-5 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-bold text-white">Live Bids</h4>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg text-sm bg-green-500/20 text-green-400 border border-green-500/30 font-medium">
              🟢 Live
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
            <div className="text-sm text-zinc-400 mb-1">Total Bidders</div>
            <div className="text-2xl font-bold text-white">{totalBidders}</div>
          </div>
          <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
            <div className="text-sm text-zinc-400 mb-1">Highest Bid</div>
            <div className="text-2xl font-bold text-green-400">
              {topBid ? `$${ethers.formatUnits(topBid.amount, 6)}` : '-'}
            </div>
          </div>
        </div>

        {/* Your Bid */}
        {userBid && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400 mb-1">Your Total Bid</div>
                <div className="text-2xl font-bold text-blue-400">
                  ${ethers.formatUnits(userBid.amount, 6)}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {userBid.chains.join(', ')} • {userBid.bidCount} {userBid.bidCount === 1 ? 'transaction' : 'transactions'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View All Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-500/30 hover:border-purple-500/40 rounded-lg text-white font-medium transition-all flex items-center justify-center gap-2"
        >
          <span>View All Bids</span>
          <span>→</span>
        </button>
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