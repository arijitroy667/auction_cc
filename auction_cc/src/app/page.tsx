"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import ConnectWalletButton from "@/components/connect-button";
import InitButton from "@/components/init-button";
import DeinitButton from "@/components/de-init-button";
import { isInitialized } from "@/lib/nexus/nexusClient";
import { result } from "@/components/unified_balance/fetch-unified-balance";
import Navbar from "@/components/navbar";

export default function Page() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [balances, setBalances] = useState<any>(null);
  const [assetDatum, setAssetDatum] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'auctions' | 'create'>('auctions');

  const btn =
    "px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

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
        <p className="text-gray-300 mb-6">Create a new cross-chain auction</p>
        {/* TODO: Auction creation form here */}
        <div className="grid gap-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-2">Asset Type</label>
            <select className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white">
              <option>Select Asset</option>
              <option>USDC</option>
              <option>ETH</option>
              <option>AVAIL</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Starting Price</label>
            <input 
              type="number" 
              placeholder="0.00"
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Duration (hours)</label>
            <input 
              type="number" 
              placeholder="24"
              className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
          </div>
        </div>
      </div>
      <button className="px-6 py-3 rounded bg-green-500 text-black hover:bg-green-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
        Create Auction
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
