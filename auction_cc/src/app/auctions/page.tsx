"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import Navbar from "@/components/navbar";
import Link from "next/link";

export default function AuctionsPage() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    try {
      // TODO: Implement actual auction fetching from your API
      // const response = await fetch('/api/auctions');
      // const data = await response.json();
      // setAuctions(data);
      
      // Mock data for now
      setTimeout(() => {
        setAuctions([
          {
            id: "1",
            title: "Cosmic Cat #1234",
            currentBid: "2.5 ETH",
            timeLeft: "2h 34m",
            image: "/placeholder-nft.jpg",
            chain: "Ethereum"
          },
          {
            id: "2", 
            title: "Digital Dreams #567",
            currentBid: "150 USDC",
            timeLeft: "5h 12m",
            image: "/placeholder-nft.jpg",
            chain: "Arbitrum"
          }
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Error fetching auctions:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAuctions();
  }, []);

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
              <select className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm">
                <option value="">All Chains</option>
                <option value="ethereum">Ethereum</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="optimism">Optimism</option>
                <option value="base">Base</option>
              </select>
              <select className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm">
                <option value="">All Categories</option>
                <option value="art">Art</option>
                <option value="gaming">Gaming</option>
                <option value="music">Music</option>
                <option value="collectibles">Collectibles</option>
              </select>
              <select className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm">
                <option value="">Sort by</option>
                <option value="ending-soon">Ending Soon</option>
                <option value="newest">Newest</option>
                <option value="highest-bid">Highest Bid</option>
              </select>
            </div>

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
              ) : auctions.length > 0 ? (
                auctions.map((auction) => (
                  <div key={auction.id} className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-200 cursor-pointer">
                    <div className="w-full h-48 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg mb-4 flex items-center justify-center">
                      <span className="text-white/50">NFT Image</span>
                    </div>
                    <h3 className="text-white font-semibold mb-2">{auction.title}</h3>
                    <p className="text-white/70 text-sm mb-2">Current bid: {auction.currentBid}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-white/50 text-sm">{auction.timeLeft} left</span>
                      <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                        {auction.chain}
                      </span>
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