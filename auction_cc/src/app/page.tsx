"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import { result } from "@/components/unified_balance/fetch-unified-balance";
import Navbar from "@/components/navbar";

export default function Page() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [balances, setBalances] = useState<any>(null);
  const [assetDatum, setAssetDatum] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'auctions' | 'create'>('home');
  
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

  const handleFormChange = (field: string, value: string) => {
    setAuctionForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateAuction = async () => {
    try {
      if (!auctionForm.nftContract || !auctionForm.tokenId || !auctionForm.startingPrice) {
        alert('Please fill in all required fields');
        return;
      }
      
      const durationInSeconds = parseInt(auctionForm.durationHours) * 3600;
      const deadline = Math.floor(Date.now() / 1000) + durationInSeconds;
      
      console.log('Creating auction with params:', {
        nftContract: auctionForm.nftContract,
        tokenId: auctionForm.tokenId,
        startingPrice: auctionForm.startingPrice,
        reservePrice: auctionForm.reservePrice || '0',
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

  const HomeTab = () => (
    <div className="relative">
      {/* Hero Section */}
      <section className="text-center py-32 px-4">
        <h1 className="text-7xl font-bold text-white mb-6 leading-tight">
          Next-Gen NFT Auctions
          <br />
          <span className="text-zinc-500">for the modern world</span>
        </h1>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-16 leading-relaxed">
          Create and participate in NFT auctions across multiple blockchains. 
          Powered by Nexus for seamless cross-chain transactions.
        </p>

        {/* CTA Buttons */}
        <div className="flex justify-center gap-4 mb-20">
          <button 
            onClick={() => setActiveTab('auctions')}
            className="px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-base"
          >
            Browse Auctions
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className="px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors text-base"
          >
            Create Auction
          </button>
        </div>
      </section>
    </div>
  );

  const AuctionsTab = () => (
    <section className="relative backdrop-blur-sm bg-white/5 rounded-2xl p-8 border border-white/10">
    {/* Back to Home Button */}
    <button 
      onClick={() => setActiveTab('home')}
      className="mb-6 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Home
    </button>
    
    <h2 className="text-3xl font-bold mb-6 text-white">Auctions</h2>
      <div className="mb-6">
        <p className="text-white/70 mb-4">View and participate in active auctions</p>
        <div className="grid gap-4">
          <div className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm">
            <p className="text-white/50">No active auctions found</p>
          </div>
        </div>
      </div>
      <button className="px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-black rounded-xl border border-white/20 hover:bg-white/10">
        Refresh Auctions
      </button>
    </section>
  );

  const CreateAuctionTab = () => (
    <section className="relative backdrop-blur-sm bg-white/5 rounded-2xl p-8 border border-white/10">
      {/* Back to Home Button */}
    <button 
      onClick={() => setActiveTab('home')}
      className="mb-6 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Home
    </button>
      <h2 className="text-3xl font-bold mb-6 text-white">Create Auction</h2>
      <div className="mb-6">
        <p className="text-white/70 mb-6">Create a new cross-chain NFT auction</p>
        
        <div className="grid gap-6 max-w-2xl">
          <div>
            <label className="block text-sm font-medium mb-2 text-white">NFT Contract Address *</label>
            <input 
              type="text" 
              placeholder="0x..."
              value={auctionForm.nftContract}
              onChange={(e) => handleFormChange('nftContract', e.target.value)}
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-white/50 focus:outline-none backdrop-blur-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white">Token ID *</label>
            <input 
              type="number" 
              placeholder="1"
              value={auctionForm.tokenId}
              onChange={(e) => handleFormChange('tokenId', e.target.value)}
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-white/50 focus:outline-none backdrop-blur-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white">Starting Price (Wei) *</label>
            <input 
              type="text" 
              placeholder="1000000000000000000"
              value={auctionForm.startingPrice}
              onChange={(e) => handleFormChange('startingPrice', e.target.value)}
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-white/50 focus:outline-none backdrop-blur-sm"
            />
            <p className="text-xs text-white/50 mt-1">Enter amount in Wei (1 ETH = 10^18 Wei)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white">Reserve Price (Wei)</label>
            <input 
              type="text" 
              placeholder="2000000000000000000"
              value={auctionForm.reservePrice}
              onChange={(e) => handleFormChange('reservePrice', e.target.value)}
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-white/50 focus:outline-none backdrop-blur-sm"
            />
            <p className="text-xs text-white/50 mt-1">Minimum price to accept (optional)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white">Duration (hours) *</label>
            <input 
              type="number" 
              placeholder="24"
              value={auctionForm.durationHours}
              onChange={(e) => handleFormChange('durationHours', e.target.value)}
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-white/50 focus:outline-none backdrop-blur-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white">Preferred Token Address</label>
            <input 
              type="text" 
              placeholder="0x... (Leave empty for ETH)"
              value={auctionForm.preferredToken}
              onChange={(e) => handleFormChange('preferredToken', e.target.value)}
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/40 focus:border-white/50 focus:outline-none backdrop-blur-sm"
            />
            <p className="text-xs text-white/50 mt-1">Token address for payments (optional)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-white">Preferred Chain</label>
            <select 
              value={auctionForm.preferredChain}
              onChange={(e) => handleFormChange('preferredChain', e.target.value)}
              className="w-full p-3 bg-black/50 border border-white/20 rounded-lg text-white focus:border-white/50 focus:outline-none backdrop-blur-sm"
            >
              <option value="1">Ethereum (1)</option>
              <option value="137">Polygon (137)</option>
              <option value="56">BSC (56)</option>
              <option value="43114">Avalanche (43114)</option>
              <option value="250">Fantom (250)</option>
              <option value="42161">Arbitrum (42161)</option>
              <option value="10">Optimism (10)</option>
            </select>
          </div>
        </div>

        <div className="mt-6 p-4 bg-white/5 border border-white/20 rounded-lg backdrop-blur-sm">
          <h4 className="text-white font-medium mb-2">Requirements:</h4>
          <ul className="text-white/70 text-sm space-y-1">
            <li>• You must own the NFT at the specified contract address and token ID</li>
            <li>• The NFT will be transferred to the auction contract during creation</li>
            <li>• Ensure the auction deadline is in the future</li>
            <li>• Connect your wallet and initialize Nexus before creating an auction</li>
          </ul>
        </div>
      </div>
      
      <div className="mt-6 relative inline-flex group">
        <div className={`absolute transition-all duration-1000 opacity-70 -inset-px rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 ${
          isConnected && initialized 
            ? 'bg-gradient-to-r from-white via-gray-300 to-white' 
            : 'bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600'
        }`}></div>
        <button 
          onClick={handleCreateAuction}
          disabled={!isConnected || !initialized}
          className={`relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold  duration-200 rounded-xl border ${
            isConnected && initialized 
              ? 'text-white bg-black border-white/20 hover:bg-black/90' 
              : 'text-white/50 bg-black/50 border-white/10 cursor-not-allowed'
          }`}
        >
          {!isConnected ? 'Connect Wallet First' : !initialized ? 'Initialize Nexus First' : 'Create Auction'}
        </button>
      </div>
    </section>
  );

  return (
    <div className="relative min-h-screen w-full bg-black">
      {/* Background Grid and Glow */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      <div className="fixed left-1/2 -translate-x-1/2 top-[-10%] h-[1000px] w-[1000px] rounded-full bg-[radial-gradient(circle_400px_at_50%_300px,#fbfbfb36,#000)]"></div>
      
      {/* Content */}
      <div className="relative z-10">
        <Navbar activeTab={activeTab === 'home' ? 'auctions' : activeTab} onTabChange={(tab) => setActiveTab(tab)} />
        <main className={`max-w-7xl mx-auto ${activeTab === 'home' ? 'pt-4' : 'pt-24 p-8'}`}>
          {activeTab === 'home' && <HomeTab />}
          {activeTab === 'auctions' && <AuctionsTab />}
          {activeTab === 'create' && <CreateAuctionTab />}
        </main>
      </div>
    </div>
  );
}