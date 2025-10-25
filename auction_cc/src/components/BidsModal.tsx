import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

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
  chains: string[];
  bidCount: number;
}

interface BidsModalProps {
  auctionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function BidsModal({ auctionId, isOpen, onClose }: BidsModalProps) {
  const { address } = useAccount();
  const [bids, setBids] = useState<AggregatedBid[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [loading, setLoading] = useState(false);
  const BASE = process.env.NEXT_PUBLIC_KEEPER_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    let timer: NodeJS.Timeout | null = null;

    async function fetchBids() {
      if (!isPolling) return;
      
      setLoading(true);
      try {
        const r = await fetch(`${BASE}/api/bids/${auctionId}`);
        const j = await r.json();
        if (!j.success || !mounted) return;
        
        const bidData: BidRecord[] = j.data || [];
        
        // Aggregate bids by bidder address
        const bidderMap = new Map<string, { 
          bidder: string; 
          amount: bigint; 
          timestamp: string; 
          intentId: string;
          chains: Set<string>;
          bidCount: number;
        }>();
        
        bidData.forEach(bid => {
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

        setBids(sorted);
      } catch (e) {
        console.error('Failed to fetch bids:', e);
      } finally {
        setLoading(false);
        if (mounted && isPolling) {
          timer = setTimeout(fetchBids, 3000);
        }
      }
    }

    fetchBids();
    
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [auctionId, isPolling, isOpen, BASE]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-4xl max-h-[90vh] border border-zinc-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">Live Bids</h2>
              <button 
                onClick={() => setIsPolling(p => !p)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                  isPolling 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/40' 
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                {isPolling ? 'Live' : 'Paused'}
              </button>
            </div>
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white text-3xl font-light transition-colors"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-zinc-400">
            {bids.length} {bids.length === 1 ? 'bidder' : 'bidders'} • Refreshes every 3 seconds
          </p>
        </div>

        {/* Bids List */}
        <div className="flex-1 overflow-y-auto p-6">
          {bids.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-zinc-500 text-lg font-semibold">No bids yet</p>
              <p className="text-zinc-600 text-sm mt-2">Be the first to place a bid!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bids.map((bid, i) => {
                const isUserBid = bid.bidder.toLowerCase() === address?.toLowerCase();
                const isTopBid = i === 0;
                
                return (
                  <div 
                    key={`${bid.bidder}-${bid.timestamp}`}
                    className={`rounded-lg border p-4 ${
                      isUserBid
                        ? 'bg-blue-500/10 border-blue-500/30' 
                        : isTopBid
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-zinc-800/50 border-zinc-700'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-zinc-400 font-mono text-sm">#{i + 1}</span>
                        {isTopBid && (
                          <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded border border-green-500/30">
                            Highest Bid
                          </span>
                        )}
                        {isUserBid && (
                          <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Address */}
                    <div className="mb-3">
                      <p className="font-mono text-white text-sm break-all">
                        {bid.bidder}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {new Date(parseInt(bid.timestamp)).toLocaleString()}
                      </p>
                    </div>
                    
                    {/* Amount */}
                    <div className="mb-3">
                      <div className={`font-bold text-xl ${
                        isTopBid ? 'text-green-400' : isUserBid ? 'text-blue-400' : 'text-white'
                      }`}>
                        ${ethers.formatUnits(bid.amount, 6)}
                      </div>
                    </div>
                    
                    {/* Chain and Transaction Info */}
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span>Chain:</span>
                        <span className="text-white">{bid.chains.join(', ')}</span>
                      </div>
                      {bid.bidCount > 1 && (
                        <span>{bid.bidCount} transactions</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-400 font-medium text-sm">
              Bids are aggregated across all chains
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-semibold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document body level
  return createPortal(modalContent, document.body);
}
