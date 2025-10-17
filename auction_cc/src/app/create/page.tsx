"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import Navbar from "@/components/navbar";
import Link from "next/link";

export default function CreateAuctionPage() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  
  // Auction form state
  const [auctionForm, setAuctionForm] = useState({
    nftContract: '',
    tokenId: '',
    startingPrice: '',
    reservePrice: '',
    durationHours: '',
    preferredToken: '',
    preferredChain: '1'
  });

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

  const handleCreateAuction = async () => {
    if (!isConnected || !initialized) {
      alert('Please connect your wallet and initialize Nexus first');
      return;
    }

    if (!auctionForm.nftContract || !auctionForm.tokenId || !auctionForm.startingPrice || !auctionForm.durationHours) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const deadline = Math.floor(Date.now() / 1000) + (parseInt(auctionForm.durationHours) * 3600);
      
      console.log('Creating auction with params:', {
        nftContract: auctionForm.nftContract,
        tokenId: auctionForm.tokenId,
        startingPrice: auctionForm.startingPrice,
        reservePrice: auctionForm.reservePrice || auctionForm.startingPrice,
        deadline,
        preferredToken: auctionForm.preferredToken,
        preferredChain: auctionForm.preferredChain
      });
      
      alert('Auction creation functionality will be implemented with contract integration');
      
    } catch (error) {
      console.error('Error creating auction:', error);
      alert('Failed to create auction');
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      
      {/* Content */}
      <div className="relative z-10">
        <Navbar activeTab="create" onTabChange={() => {}} />
        <main className="max-w-4xl mx-auto pt-24 p-8">
          <div className="relative backdrop-blur-sm bg-white/5 rounded-2xl p-8 border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">Create Auction</h1>
                <p className="text-white/70">List your NFT for auction across multiple blockchains</p>
              </div>
              <Link
                href="/auctions"
                className="px-6 py-3 bg-white/10 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
              >
                Browse Auctions
              </Link>
            </div>

            {/* Form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Form Fields */}
              <div className="space-y-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    NFT Contract Address *
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.nftContract}
                    onChange={(e) => setAuctionForm({...auctionForm, nftContract: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Token ID *
                  </label>
                  <input
                    type="text"
                    placeholder="1234"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.tokenId}
                    onChange={(e) => setAuctionForm({...auctionForm, tokenId: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Starting Price *
                  </label>
                  <input
                    type="text"
                    placeholder="0.1"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.startingPrice}
                    onChange={(e) => setAuctionForm({...auctionForm, startingPrice: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Reserve Price (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="1.0"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.reservePrice}
                    onChange={(e) => setAuctionForm({...auctionForm, reservePrice: e.target.value})}
                  />
                </div>
              </div>

              {/* Right Column - Additional Settings */}
              <div className="space-y-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Auction Duration (Hours) *
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.durationHours}
                    onChange={(e) => setAuctionForm({...auctionForm, durationHours: e.target.value})}
                  >
                    <option value="">Select duration</option>
                    <option value="1">1 Hour</option>
                    <option value="6">6 Hours</option>
                    <option value="24">24 Hours</option>
                    <option value="72">3 Days</option>
                    <option value="168">7 Days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Preferred Token
                  </label>
                  <input
                    type="text"
                    placeholder="ETH, USDC, etc."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.preferredToken}
                    onChange={(e) => setAuctionForm({...auctionForm, preferredToken: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Preferred Chain
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.preferredChain}
                    onChange={(e) => setAuctionForm({...auctionForm, preferredChain: e.target.value})}
                  >
                    <option value="1">Ethereum</option>
                    <option value="137">Polygon</option>
                    <option value="42161">Arbitrum</option>
                    <option value="8453">Base</option>
                  </select>
                </div>

                {/* NFT Preview */}
                <div className="mt-8">
                  <label className="block text-white font-medium mb-2">
                    NFT Preview
                  </label>
                  <div className="w-full h-48 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border border-white/20 flex items-center justify-center">
                    <span className="text-white/50">NFT preview will appear here</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Requirements */}
            <div className="mt-8 p-6 bg-white/5 border border-white/20 rounded-lg backdrop-blur-sm">
              <h4 className="text-white font-medium mb-3">Requirements:</h4>
              <ul className="text-white/70 text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  You must own the NFT at the specified contract address and token ID
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  The NFT will be transferred to the auction contract during creation
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  Ensure the auction deadline is in the future
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  Connect your wallet and initialize Nexus before creating an auction
                </li>
              </ul>
            </div>

            {/* Create Button */}
            <div className="mt-8 flex justify-center">
              <div className="relative inline-flex group">
                <div className={`absolute transition-all duration-1000 opacity-70 -inset-px rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 ${
                  isConnected && initialized 
                    ? 'bg-gradient-to-r from-white via-gray-300 to-white' 
                    : 'bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600'
                }`}></div>
                <button 
                  onClick={handleCreateAuction}
                  disabled={!isConnected || !initialized}
                  className={`relative inline-flex items-center justify-center px-12 py-4 text-lg font-bold duration-200 rounded-xl border ${
                    isConnected && initialized 
                      ? 'text-white bg-black border-white/20 hover:bg-black/90' 
                      : 'text-white/50 bg-black/50 border-white/10 cursor-not-allowed'
                  }`}
                >
                  {!isConnected ? 'Connect Wallet First' : !initialized ? 'Initialize Nexus First' : 'Create Auction'}
                </button>
              </div>
            </div>

            {/* Status Messages */}
            {!isConnected && (
              <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg backdrop-blur-sm">
                <p className="text-yellow-300 text-center">
                  Connect your wallet to create auctions
                </p>
              </div>
            )}

            {isConnected && !initialized && (
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg backdrop-blur-sm">
                <p className="text-blue-300 text-center">
                  Initialize Nexus to enable cross-chain auction creation
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}