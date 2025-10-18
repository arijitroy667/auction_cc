import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

interface BidRecord {
  intentId: string;
  bidder: string;
  amount: string;
  timestamp: string;
}

export default function LiveBidLeaderboard({ auctionId }: { auctionId: string }) {
  const { address } = useAccount();
  const [top, setTop] = useState<BidRecord[]>([]);
  const [userBid, setUserBid] = useState<BidRecord | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const BASE = process.env.NEXT_PUBLIC_KEEPER_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let mounted = true;
    let timer: NodeJS.Timeout | null = null;

    async function poll() {
      if (!isPolling) return;
      
      try {
        const r = await fetch(`${BASE}/api/bids/${auctionId}`);
        const j = await r.json();
        if (!j.success || !mounted) return;
        
        const bids: BidRecord[] = j.data || [];
        const sorted = bids.sort((a, b) => {
          try { return BigInt(b.amount) > BigInt(a.amount) ? 1 : -1; }
          catch { return 0; }
        });

        setTop(sorted.slice(0, 10));
        
        if (address) {
          const myBid = sorted.find(b => b.bidder.toLowerCase() === address.toLowerCase());
          setUserBid(myBid || null);
        }
      } catch (e) {
        console.error('LiveBidLeaderboard poll error:', e);
      } finally {
        if (mounted && isPolling) {
          timer = setTimeout(poll, 3000);
        }
      }
    }

    poll();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [auctionId, address, isPolling]);

  return (
    <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-white">Live Bids</h4>
        <button 
          onClick={() => setIsPolling(p => !p)}
          className={`px-2 py-1 rounded text-sm ${isPolling ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-400'}`}
        >
          {isPolling ? 'Live 🟢' : 'Paused ⏸️'}
        </button>
      </div>

      <div className="space-y-2">
        {top.length === 0 ? (
          <div className="text-zinc-500 text-center py-4">No bids yet</div>
        ) : (
          top.map((bid, i) => (
            <div 
              key={`${bid.bidder}-${bid.timestamp}`}
              className={`flex items-center justify-between p-3 rounded-lg ${
                bid.bidder.toLowerCase() === address?.toLowerCase() 
                  ? 'bg-blue-500/20 border border-blue-500/30' 
                  : 'bg-zinc-800/50 border border-zinc-700/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">#{i + 1}</span>
                <span className="font-mono text-white/90">
                  {bid.bidder.slice(0,6)}...{bid.bidder.slice(-4)}
                </span>
              </div>
              <span className="font-bold text-white">
                {ethers.formatEther(bid.amount)} ETH
              </span>
            </div>
          ))
        )}
      </div>

      {userBid && (
        <div className="pt-4 border-t border-zinc-800">
          <div className="text-sm text-zinc-400 mb-2">Your Latest Bid</div>
          <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
            <div className="flex justify-between items-center">
              <span className="font-mono text-white/90">
                {userBid.bidder.slice(0,6)}...{userBid.bidder.slice(-4)}
              </span>
              <span className="font-bold text-white">
                {ethers.formatEther(userBid.amount)} ETH
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-1">
              {new Date(parseInt(userBid.timestamp)).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}