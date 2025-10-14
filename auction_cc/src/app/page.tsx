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
  const [activeTab, setActiveTab] = useState<'auctions' | 'create'>('auctions');
  
  // Auction form state
  const [auctionForm, setAuctionForm] = useState({
    nftContract: '',
    tokenId: '',
    startingPrice: '',
    reservePrice: '',
    durationHours: '',
    preferredToken: '',
    preferredChain: '1' // Default to Ethereum
  });

  const btn =
    "px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  // Check for Nexus initialization status changes
  useEffect(() => {
    const checkInitialization = () => {
      const nexusReady = isInitialized();
      if (nexusReady !== initialized) {
        setInitialized(nexusReady);
      }
    };

    // Check immediately
    checkInitialization();

    // Set up interval to check periodically
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
      // Validate required fields
      if (!auctionForm.nftContract || !auctionForm.tokenId || !auctionForm.startingPrice) {
        alert('Please fill in all required fields');
        return;
      }
      
      // Calculate deadline (current time + duration in hours)
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
      
      // TODO: Implement actual contract interaction here
      alert('Auction creation functionality will be implemented with contract integration');
      
    } catch (error) {
      console.error('Error creating auction:', error);
      alert('Failed to create auction');
    }
  };

  const AuctionsTab = () => (
    <section className="bg-gray-900 rounded-lg p-8 shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-yellow-400">Auctions</h2>
      <div className="mb-6">
        <p className="text-gray-300 mb-4">View and participate in active auctions</p>
        {/* TODO: List auctions here */}
        <div className="grid gap-4">
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <p className="text-gray-400">No active auctions found</p>
          </div>
        </div>
      </div>
      <button className="px-6 py-3 rounded bg-yellow-500 text-black hover:bg-yellow-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
        Refresh Auctions
      </button>
    </section>
  );

  const CreateAuctionTab = () => (
    <section className="bg-gray-900 rounded-lg p-8 shadow-lg">
      <h2 className="text-3xl font-bold mb-6 text-green-400">Create Auction</h2>
      <div className="mb-6">
        <p className="text-gray-300 mb-6">Create a new cross-chain NFT auction</p>
        
        <div className="grid gap-6 max-w-2xl">
          {/* NFT Contract Address */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">NFT Contract Address *</label>
            <input 
              type="text" 
              placeholder="0x..."
              value={auctionForm.nftContract}
              onChange={(e) => handleFormChange('nftContract', e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-green-400 focus:outline-none"
            />
          </div>

          {/* Token ID */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Token ID *</label>
            <input 
              type="number" 
              placeholder="1"
              value={auctionForm.tokenId}
              onChange={(e) => handleFormChange('tokenId', e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-green-400 focus:outline-none"
            />
          </div>

          {/* Starting Price */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Starting Price (Wei) *</label>
            <input 
              type="text" 
              placeholder="1000000000000000000"
              value={auctionForm.startingPrice}
              onChange={(e) => handleFormChange('startingPrice', e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-green-400 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Enter amount in Wei (1 ETH = 10^18 Wei)</p>
          </div>

          {/* Reserve Price */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Reserve Price (Wei)</label>
            <input 
              type="text" 
              placeholder="2000000000000000000"
              value={auctionForm.reservePrice}
              onChange={(e) => handleFormChange('reservePrice', e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-green-400 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Minimum price to accept (optional)</p>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Duration (hours) *</label>
            <input 
              type="number" 
              placeholder="24"
              value={auctionForm.durationHours}
              onChange={(e) => handleFormChange('durationHours', e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-green-400 focus:outline-none"
            />
          </div>

          {/* Preferred Token */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Preferred Token Address</label>
            <input 
              type="text" 
              placeholder="0x... (Leave empty for ETH)"
              value={auctionForm.preferredToken}
              onChange={(e) => handleFormChange('preferredToken', e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-green-400 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Token address for payments (optional)</p>
          </div>

          {/* Preferred Chain */}
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Preferred Chain</label>
            <select 
              value={auctionForm.preferredChain}
              onChange={(e) => handleFormChange('preferredChain', e.target.value)}
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-green-400 focus:outline-none"
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

        {/* Requirements Notice */}
        <div className="mt-6 p-4 bg-yellow-900 border border-yellow-600 rounded-lg">
          <h4 className="text-yellow-400 font-medium mb-2">Requirements:</h4>
          <ul className="text-yellow-200 text-sm space-y-1">
            <li>• You must own the NFT at the specified contract address and token ID</li>
            <li>• The NFT will be transferred to the auction contract during creation</li>
            <li>• Ensure the auction deadline is in the future</li>
            <li>• Connect your wallet and initialize Nexus before creating an auction</li>
          </ul>
        </div>
      </div>
      
      <button 
        onClick={handleCreateAuction}
        disabled={!isConnected || !initialized}
        className={`px-6 py-3 rounded transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
          isConnected && initialized 
            ? 'bg-green-500 text-black hover:bg-green-600' 
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        {!isConnected ? 'Connect Wallet First' : !initialized ? 'Initialize Nexus First' : 'Create Auction'}
      </button>
    </section>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="p-8 max-w-7xl mx-auto">
        {activeTab === 'auctions' ? <AuctionsTab /> : <CreateAuctionTab />}
      </main>
    </div>
  );
}
