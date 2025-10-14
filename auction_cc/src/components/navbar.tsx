import React, { useState, useEffect } from "react";
import ConnectWalletButton from "../components/connect-button";
import {
  initializeWithProvider,
  isInitialized,
} from "../lib/nexus/nexusClient";
import { result as fetchUnifiedBalance } from "../components/unified_balance/fetch-unified-balance";
import { useAccount } from "wagmi";

interface NavbarProps {
  activeTab?: 'auctions' | 'create';
  onTabChange?: (tab: 'auctions' | 'create') => void;
}

export default function Navbar({ activeTab = 'auctions', onTabChange }: NavbarProps) {
  const { isConnected } = useAccount();
  const [balance, setBalance] = useState<string | null>(null);
  const [nexusInitialized, setNexusInitialized] = useState(false);

  // Auto-initialize Nexus when wallet connects
  useEffect(() => {
    const autoInitNexus = async () => {
      if (isConnected && !nexusInitialized && !isInitialized()) {
        const provider = (window as any).ethereum;
        if (provider) {
          try {
            await initializeWithProvider(provider);
            setNexusInitialized(true);
          } catch (error) {
            console.error("Failed to initialize Nexus:", error);
          }
        }
      }
    };

    autoInitNexus();
  }, [isConnected, nexusInitialized]);

  const handleFetchBalance = async () => {
    try {
      const bal = await fetchUnifiedBalance();
      console.log("Fetched balance:", bal);
      
      // Check if bal is an array and has elements
      if (Array.isArray(bal) && bal.length > 0 && bal[0].balanceInFiat !== undefined) {
        setBalance(`$${bal[0].balanceInFiat}`);
      } 
      // Fallback: check if bal is an object with balanceInFiat property
      else if (bal && typeof bal === 'object' && 'balanceInFiat' in bal) {
        setBalance(`$${bal.balanceInFiat}`);
      } 
      else {
        setBalance('Balance unavailable');
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setBalance('Error fetching balance');
    }
  };

  return (
    <div>
      <nav className="flex justify-between items-center px-12 py-6 bg-black border-b border-gray-800">
        {/* Left side - Logo and Project Name */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <span className="text-black font-bold text-xl">A</span>
          </div>
          <h1 className="text-white text-2xl font-semibold">Cross-Chain Auction</h1>
        </div>

        {/* Right side - Wallet and Balance */}
        <div className="flex items-center gap-6">
          {isConnected && nexusInitialized && (
            <button
              className="px-6 py-3 rounded bg-white text-black hover:bg-gray-200 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              onClick={handleFetchBalance}
            >
              View Unified Balance
            </button>
          )}
          
          <ConnectWalletButton 
            className="px-6 py-3 rounded bg-white text-black hover:bg-gray-200 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          />
          
          {balance && (
            <span className="ml-2 text-lg font-semibold text-green-400 bg-gray-800 px-4 py-2 rounded">
              {balance}
            </span>
          )}
        </div>
      </nav>
      
      {/* Navigation Tabs */}
      {onTabChange && (
        <div className="bg-gray-900 border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-12">
            <div className="flex gap-8">
              <button
                onClick={() => onTabChange('auctions')}
                className={`px-6 py-4 font-medium transition-all duration-200 border-b-2 ${
                  activeTab === 'auctions'
                    ? 'text-yellow-400 border-yellow-400'
                    : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
                }`}
              >
                Auctions
              </button>
              <button
                onClick={() => onTabChange('create')}
                className={`px-6 py-4 font-medium transition-all duration-200 border-b-2 ${
                  activeTab === 'create'
                    ? 'text-green-400 border-green-400'
                    : 'text-gray-400 border-transparent hover:text-white hover:border-gray-600'
                }`}
              >
                Create Auction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
