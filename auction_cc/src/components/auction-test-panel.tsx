"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import { getAuctionHubContract } from "@/lib/auctionHub";

enum AuctionStatus {
  Created = 0,
  Active = 1,
  Finalized = 2,
  Settled = 3,
  Cancelled = 4
}

interface AuctionData {
  nftContract: string;
  tokenId: string;
  seller: string;
  startingPrice: string;
  reservePrice: string;
  deadline: number;
  preferdToken: string;
  preferdChain: number;
  status: AuctionStatus;
  highestBid: string;
  highestBidder: string;
}

export default function AuctionTestPanel() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  const [intentId, setIntentId] = useState("");
  const [auctionData, setAuctionData] = useState<AuctionData | null>(null);
  const [allIntentIds, setAllIntentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getStatusDisplay = (status: AuctionStatus) => {
    switch (status) {
      case AuctionStatus.Created:
        return { text: '🟡 Created', color: 'text-yellow-400' };
      case AuctionStatus.Active:
        return { text: '🟢 Active', color: 'text-green-400' };
      case AuctionStatus.Finalized:
        return { text: '🔵 Finalized', color: 'text-blue-400' };
      case AuctionStatus.Settled:
        return { text: '✅ Settled', color: 'text-emerald-400' };
      case AuctionStatus.Cancelled:
        return { text: '❌ Cancelled', color: 'text-red-400' };
      default:
        return { text: '❓ Unknown', color: 'text-gray-400' };
    }
  };

  const handleViewNFT = async () => {
    if (!intentId.trim()) {
      setError("Please enter an auction ID");
      return;
    }

    if (!walletClient || !isConnected) {
      setError("Please connect your wallet");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const auctionHub = getAuctionHubContract(signer);

      const auction = await auctionHub.getAuction(intentId);
      console.log("Fetched auction data:", auction.preferdChain);
      
      setAuctionData({
        nftContract: auction.nftContract,
        tokenId: auction.tokenId.toString(),
        seller: auction.seller,
        startingPrice: ethers.formatUnits(auction.startingPrice, 6),
        reservePrice: ethers.formatUnits(auction.reservePrice, 6),
        deadline: Number(auction.deadline),
        preferdToken: auction.preferdToken,
        preferdChain: Number(auction.preferdChain),
        status: Number(auction.status) as AuctionStatus,
        highestBid: ethers.formatUnits(auction.highestBid, 6),
        highestBidder: auction.highestBidder
      });

      setSuccess("Auction data loaded successfully!");
    } catch (err: any) {
      console.error("Error viewing auction:", err);
      setError(err.message || "Failed to load auction data");
      setAuctionData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAuction = async () => {
    if (!intentId.trim()) {
      setError("Please enter an auction ID");
      return;
    }

    if (!walletClient || !isConnected) {
      setError("Please connect your wallet");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const auctionHub = getAuctionHubContract(signer);

      const receipt = await auctionHub.cancelAuction(intentId);
      
      setSuccess(`Auction cancelled successfully! Transaction hash: ${receipt.hash}`);
      setAuctionData(null);
    } catch (err: any) {
      console.error("Error cancelling auction:", err);
      setError(err.message || "Failed to cancel auction");
    } finally {
      setLoading(false);
    }
  };

  const handleGetAllIntentIds = async () => {
    if (!walletClient || !isConnected) {
      setError("Please connect your wallet");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const auctionHub = getAuctionHubContract(signer);

      const intentIds = await auctionHub.getAllIntentIds();
      
      setAllIntentIds(intentIds);
      setSuccess(`Found ${intentIds.length} auction(s)`);
    } catch (err: any) {
      console.error("Error fetching all intent IDs:", err);
      setError(err.message || "Failed to fetch intent IDs");
      setAllIntentIds([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="mt-16 p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm max-w-4xl mx-auto">
      <h3 className="text-white font-semibold mb-6 text-xl">🧪 Auction Test Panel</h3>
      
      {/* Input Section */}
      <div className="mb-6">
        <label className="block text-white text-sm font-medium mb-2">
          Auction ID (Intent ID)
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={intentId}
            onChange={(e) => setIntentId(e.target.value)}
            placeholder="Enter auction ID..."
            className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <button
          onClick={handleViewNFT}
          disabled={loading || !isConnected}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {loading ? "Loading..." : "🔍 View NFT Details"}
        </button>
        
        <button
          onClick={handleCancelAuction}
          disabled={loading || !isConnected}
          className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {loading ? "Processing..." : "❌ Cancel Auction"}
        </button>

        <button
          onClick={handleGetAllIntentIds}
          disabled={loading || !isConnected}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {loading ? "Loading..." : "📋 Get All Intent IDs"}
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-300">❌ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <p className="text-green-300">✅ {success}</p>
        </div>
      )}

      {/* Auction Data Display */}
      {auctionData && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
          <h4 className="text-white font-semibold mb-4 text-lg">📋 Auction Details</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">NFT Contract:</span>
              <p className="text-white font-mono break-all">{auctionData.nftContract}</p>
            </div>
            
            <div>
              <span className="text-gray-400">Token ID:</span>
              <p className="text-white">{auctionData.tokenId}</p>
            </div>
            
            <div>
              <span className="text-gray-400">Seller:</span>
              <p className="text-white font-mono break-all">{auctionData.seller}</p>
            </div>
            
            <div>
              <span className="text-gray-400">Status:</span>
              <p className={`font-medium ${getStatusDisplay(auctionData.status).color}`}>
                {getStatusDisplay(auctionData.status).text}
              </p>
            </div>
            
            <div>
              <span className="text-gray-400">Starting Price:</span>
              <p className="text-white">{auctionData.startingPrice} ETH</p>
            </div>
            
            <div>
              <span className="text-gray-400">Reserve Price:</span>
              <p className="text-white">{auctionData.reservePrice} ETH</p>
            </div>
            
            <div>
              <span className="text-gray-400">Highest Bid:</span>
              <p className="text-white">{auctionData.highestBid} ETH</p>
            </div>
            
            <div>
              <span className="text-gray-400">Highest Bidder:</span>
              <p className="text-white font-mono break-all">
                {auctionData.highestBidder === '0x0000000000000000000000000000000000000000' 
                  ? 'No bids yet' 
                  : auctionData.highestBidder
                }
              </p>
            </div>
            
            <div>
              <span className="text-gray-400">Preferred Chain:</span>
              <p className="text-white">{auctionData.preferdChain}</p>
            </div>
            
            <div>
              <span className="text-gray-400">Deadline:</span>
              <p className="text-white">{formatDate(auctionData.deadline)}</p>
            </div>
          </div>
        </div>
      )}

      {/* All Intent IDs Display */}
      {allIntentIds.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
          <h4 className="text-white font-semibold mb-4 text-lg">🗂️ All Intent IDs ({allIntentIds.length})</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allIntentIds.map((id, index) => (
              <div 
                key={id} 
                className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => setIntentId(id)}
                title="Click to load this intent ID"
              >
                <div className="text-xs text-gray-400 mb-1">#{index + 1}</div>
                <div className="text-white font-mono text-sm break-all">{id}</div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-blue-300 text-sm">💡 Click on any Intent ID to load it into the input field</p>
          </div>
        </div>
      )}

      {!isConnected && (
        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-300">⚠️ Please connect your wallet to use test functions</p>
        </div>
      )}
    </div>
  );
}
