"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import Navbar from "@/components/navbar";
import Link from "next/link";
import { ethers } from "ethers";
import BidForm from '@/components/BidComponent';
import LiveBidLeaderboard from '@/components/LiveBid';

interface Auction {
  intentId: string;
  seller: string;
  nftContract: string;
  tokenId: string;
  startingPrice: string;
  reservePrice: string;
  deadline: string;
  preferdToken: string;
  preferdChain: string;
  sourceChain: string;
  status: number;
  txHash: string;
  timestamp: string;
}

interface KeeperAuctionsResponse {
  success: boolean;
  count: number;
  data: Auction[];
  timestamp: string;
}

const KEEPER_API_URL = 'http://localhost:3001';
const CHAIN_NAMES: { [key: string]: string } = {
  'ethereum': 'Ethereum Sepolia',
  'arbitrumSepolia': 'Arbitrum Sepolia',
  'base': 'Base Sepolia',
  'optimism': 'Optimism Sepolia'
};

export default function AuctionsPage() {
  const { isConnected , address } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedChain, setSelectedChain] = useState<string>('');
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  // Check for Nexus initialization status changes
  useEffect(() => {
    const checkInitialization = () => {
      const nexusReady = isInitialized();
      if (nexusReady !== initialized) {
        setInitialized(nexusReady);
      }
    };

    checkInitialization();
    const interval = setInterval(checkInitialization, 1000);
    return () => clearInterval(interval);
  }, [initialized]);

  const refreshAuctions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${KEEPER_API_URL}/api/auctions`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch auctions: ${response.statusText}`);
      }

      const data: KeeperAuctionsResponse = await response.json();
      
      if (data.success) {
        // Filter active auctions (status 0 = active)
        const activeAuctions = data.data.filter(auction => {
          const now = Math.floor(Date.now() / 1000);
          const deadline = parseInt(auction.deadline);
          return auction.status === 0 && deadline > now;
        });
        
        setAuctions(activeAuctions);
        console.log(`Fetched ${activeAuctions.length} active auctions from keeper`);
      } else {
        throw new Error('Invalid response from keeper API');
      }
    } catch (error) {
      console.error('Error fetching auctions:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch auctions');
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  };

const handleBidSubmit = async (amount: string) => {
  if (!selectedAuction || !isConnected || !address) {
    throw new Error('Wallet not connected or auction not selected');
  }

  if (!amount || isNaN(Number(amount))) {
    throw new Error('Invalid amount');
  }

  try {
    const wei = ethers.parseEther(amount).toString();
    const url = `${KEEPER_API_URL.replace(/\/+$/, '')}/api/bids/${encodeURIComponent(selectedAuction.intentId)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bidder: address,
        amount: wei,
        token: selectedAuction.preferdToken ?? null,
        sourceChain: selectedAuction.sourceChain ?? null
      })
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'Failed to place bid');
    }

    await refreshAuctions();
    setSelectedAuction(null);
    return json.data;
  } catch (err) {
    console.error('handleBidSubmit error:', err);
    throw err;
  }
};


  useEffect(() => {
    refreshAuctions();
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshAuctions, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeLeft = (deadline: string) => {
    const now = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    const secondsLeft = deadlineNum - now;
    
    if (secondsLeft <= 0) return 'Ended';
    
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const formatPrice = (price: string) => {
    try {
      return ethers.formatEther(price);
    } catch {
      return '0';
    }
  };

  const filteredAuctions = selectedChain 
    ? auctions.filter(a => a.sourceChain === selectedChain)
    : auctions;

  return (
    <div className="relative min-h-screen w-full bg-black">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      
      {/* Content */}
      <div className="relative z-10">
        <Navbar activeTab="auctions" onTabChange={() => {}} />
        <main className="max-w-7xl mx-auto pt-24 p-8">
          <div className="relative backdrop-blur-sm bg-white/5 rounded-2xl p-8 border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">Browse Auctions</h1>
                <p className="text-white/70">Discover and bid on NFTs across multiple blockchains</p>
              </div>
              <Link
                href="/create"
                className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
              >
                Create Auction
              </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-8">
              <select 
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm"
              >
                <option value="">All Chains</option>
                <option value="ethereum">Ethereum Sepolia</option>
                <option value="arbitrumSepolia">Arbitrum Sepolia</option>
                <option value="optimism">Optimism Sepolia</option>
                <option value="base">Base Sepolia</option>
              </select>
              <div className="flex-1"></div>
              <div className="text-white/70 text-sm flex items-center">
                <span className="mr-2">📊</span>
                {filteredAuctions.length} active auction{filteredAuctions.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
                <p className="text-red-300 text-center">
                  ⚠️ {error}
                </p>
              </div>
            )}

            {/* Auctions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {loading ? (
                // Loading skeletons
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm animate-pulse">
                    <div className="w-full h-48 bg-white/10 rounded-lg mb-4"></div>
                    <div className="h-4 bg-white/10 rounded mb-2"></div>
                    <div className="h-3 bg-white/10 rounded mb-4 w-2/3"></div>
                    <div className="h-3 bg-white/10 rounded w-1/2"></div>
                  </div>
                ))
              ) : filteredAuctions.length > 0 ? (
                filteredAuctions.map((auction) => (
                  <div 
                    key={auction.intentId} 
                    className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-full h-48 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                        <span className="text-white/30 text-xs mb-2">NFT Contract</span>
                        <span className="text-white/50 text-xs font-mono break-all text-center">
                          {auction.nftContract.slice(0, 6)}...{auction.nftContract.slice(-4)}
                        </span>
                        <span className="text-white/70 text-2xl font-bold mt-2">#{auction.tokenId}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-white font-semibold truncate group-hover:text-blue-300 transition-colors">
                        Token #{auction.tokenId}
                      </h3>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Starting:</span>
                        <span className="text-white/90 font-mono">{formatPrice(auction.startingPrice)} ETH</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Reserve:</span>
                        <span className="text-white/90 font-mono">{formatPrice(auction.reservePrice)} ETH</span>
                      </div>
                      
                      <div className="pt-3 border-t border-white/10">
                        <div className="flex justify-between items-center">
                          <span className="text-white/50 text-sm flex items-center">
                            <span className="mr-1">⏰</span>
                            {formatTimeLeft(auction.deadline)}
                          </span>
                          <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                            {CHAIN_NAMES[auction.sourceChain] || auction.sourceChain}
                          </span>
                        </div>
                      </div>
                      
                      <button
  onClick={() => setSelectedAuction(auction)}
  className="mt-4 w-full py-2 bg-white text-black rounded-lg font-semibold hover:bg-zinc-200 transition-colors"
>
  Place Bid
</button>

                      <div className="pt-2">
                        <a
                          href={`https://sepolia.etherscan.io/tx/${auction.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center"
                        >
                          <span className="mr-1">🔗</span>
                          View Transaction
                        </a>
                        
                      </div>
                      <LiveBidLeaderboard auctionId={auction.intentId} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full bg-white/5 p-12 rounded-xl border border-white/10 backdrop-blur-sm text-center">
                  <div className="text-6xl mb-4">🎨</div>
                  <h3 className="text-white text-xl font-semibold mb-2">No Active Auctions</h3>
                  <p className="text-white/50 mb-6">Be the first to create an auction!</p>
                  <Link
                    href="/create"
                    className="inline-flex px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
                  >
                    Create First Auction
                  </Link>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <div className="text-center">
              <button 
                onClick={refreshAuctions}
                disabled={loading}
                className="px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-black rounded-xl border border-white/20 hover:bg-white/10 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh Auctions'}
              </button>
            </div>
            {selectedAuction && (
  <BidForm
    auctionId={selectedAuction.intentId}
    startingPrice={selectedAuction.startingPrice}
    onBidSubmit={handleBidSubmit}
    onClose={() => setSelectedAuction(null)}
  />
)}
            {/* Connection Status */}
            {!isConnected && (
              <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg backdrop-blur-sm">
                <p className="text-yellow-300 text-center">
                  Connect your wallet to participate in auctions
                </p>
              </div>
            )}

            {isConnected && !initialized && (
              <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg backdrop-blur-sm">
                <p className="text-blue-300 text-center">
                  Initialize Nexus to enable cross-chain bidding
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}