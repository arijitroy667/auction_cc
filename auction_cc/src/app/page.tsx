"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import { result } from "@/components/unified_balance/fetch-unified-balance";
import Navbar from "@/components/navbar";
import Link from "next/link";

export default function Page() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [balances, setBalances] = useState<any>(null);
  const [assetDatum, setAssetDatum] = useState<any>(null);

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

  useEffect(() => {
    const fetchAssetDatum = async () => {
      if (initialized && isConnected) {
        const data = await result();
        setAssetDatum(data);
      } else {
        setAssetDatum(null);
      }
    };
    fetchAssetDatum();
  }, [initialized, isConnected]);

  return (
    <div className="relative min-h-screen w-full bg-black">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      
      {/* Content */}
      <div className="relative z-10">
        <Navbar activeTab="home" onTabChange={() => {}} />
        <main className="max-w-7xl mx-auto pt-4">
          {/* Hero Section */}
          <section className="text-center py-32 px-4 relative overflow-hidden">
            {/* Floating particles */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-float opacity-60"></div>
              <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-purple-400 rounded-full animate-float opacity-80" style={{animationDelay: '1s'}}></div>
              <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-pink-400 rounded-full animate-float opacity-40" style={{animationDelay: '2s'}}></div>
              <div className="absolute top-2/3 right-1/3 w-2 h-2 bg-cyan-400 rounded-full animate-float opacity-70" style={{animationDelay: '3s'}}></div>
              <div className="absolute bottom-1/4 right-1/2 w-1 h-1 bg-indigo-400 rounded-full animate-float opacity-60" style={{animationDelay: '4s'}}></div>
            </div>
            
            <h1 className="text-7xl font-bold mb-6 leading-tight relative">
              <span className="relative inline-block group">
                {/* Main text with gradient and glow */}
                <span className="relative z-20 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                  Next-Gen NFT Auctions
                </span>
                {/* Animated glow layer 1 */}
                <span className="absolute inset-0 z-10 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent blur-sm opacity-60 animate-pulse"></span>
                {/* Animated glow layer 2 */}
                <span className="absolute inset-0 z-0 bg-gradient-to-r from-cyan-300 via-blue-500 to-purple-600 bg-clip-text text-transparent blur-lg opacity-40 animate-glow"></span>
                {/* Shimmer effect */}
                <div className="absolute inset-0 z-30 animate-shimmer opacity-30"></div>
              </span>
              <br />
              <span className="relative inline-block mt-2 group">
                <span className="relative z-10 bg-gradient-to-r from-zinc-400 via-zinc-300 to-zinc-400 bg-clip-text text-transparent animate-fade-in">
                  for the modern world
                </span>
                <span className="absolute inset-0 text-zinc-200 blur-md opacity-30 animate-glow"></span>
              </span>
            </h1>
            
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-16 leading-relaxed">
              Create and participate in NFT auctions across multiple blockchains. 
              Powered by Nexus for seamless cross-chain transactions.
            </p>

            {/* CTA Buttons */}
            <div className="flex justify-center gap-4 mb-20">
              <Link 
                href="/auctions"
                className="px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-base"
              >
                Browse Auctions
              </Link>
              <Link 
                href="/create"
                className="px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-base"
              >
                Create Auction
              </Link>
            </div>

            {/* Features Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20 max-w-6xl mx-auto">
              <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-6 border border-white/10">
                <div className="text-4xl mb-4">🌐</div>
                <h3 className="text-xl font-semibold text-white mb-2">Cross-Chain</h3>
                <p className="text-zinc-400">Bid on NFTs across Ethereum, Polygon, Arbitrum, and Base networks seamlessly.</p>
              </div>
              <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-6 border border-white/10">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-xl font-semibold text-white mb-2">Fast & Secure</h3>
                <p className="text-zinc-400">Powered by Nexus technology for instant cross-chain transactions with security.</p>
              </div>
              <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-6 border border-white/10">
                <div className="text-4xl mb-4">💎</div>
                <h3 className="text-xl font-semibold text-white mb-2">Premium NFTs</h3>
                <p className="text-zinc-400">Discover rare and exclusive NFT collections from top artists and creators.</p>
              </div>
            </div>

            {/* Connection Status */}
            {!isConnected && (
              <div className="mt-16 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl backdrop-blur-sm max-w-2xl mx-auto">
                <h3 className="text-yellow-300 font-semibold mb-2">Get Started</h3>
                <p className="text-yellow-300/80">Connect your wallet to start participating in auctions.</p>
              </div>
            )}

            {isConnected && !initialized && (
              <div className="mt-16 p-6 bg-blue-500/10 border border-blue-500/20 rounded-xl backdrop-blur-sm max-w-2xl mx-auto">
                <h3 className="text-blue-300 font-semibold mb-2">Almost Ready!</h3>
                <p className="text-blue-300/80">Initialize Nexus to enable cross-chain auction features.</p>
              </div>
            )}

            {isConnected && initialized && (
              <div className="mt-16 p-6 bg-green-500/10 border border-green-500/20 rounded-xl backdrop-blur-sm max-w-2xl mx-auto">
                <h3 className="text-green-300 font-semibold mb-2">🎉 You're all set!</h3>
                <p className="text-green-300/80">Your wallet is connected and Nexus is initialized. Start exploring auctions!</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}