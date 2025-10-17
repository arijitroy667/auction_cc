"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { getAuctionHubContract } from "@/lib/auctionHub";
import { ethers, BrowserProvider } from "ethers";
import { CHAIN_NAMES } from "@/lib/constants";

interface AuctionDetails {
  intentId: string;
  seller: string;
  nftContract: string;
  tokenId: string;
  startingPrice: string;
  reservePrice: string;
  deadline: string;
  preferdToken: string;
  preferdChain: number;
  highestBidder: string;
  highestBid: string;
  status: number;
}

const AuctionStatus = {
  0: 'Created',
  1: 'Active',
  2: 'Finalized', 
  3: 'Settled',
  4: 'Cancelled'
};

export default function AuctionTestPanel() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  // States for cancel auction
  const [cancelIntentId, setCancelIntentId] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelResult, setCancelResult] = useState<string>("");
  
  // States for view auction
  const [viewIntentId, setViewIntentId] = useState("");
  const [viewLoading, setViewLoading] = useState(false);
  const [auctionDetails, setAuctionDetails] = useState<AuctionDetails | null>(null);
  const [viewError, setViewError] = useState<string>("");

  const handleCancelAuction = async () => {
    if (!walletClient || !cancelIntentId.trim()) {
      setCancelResult("Please connect wallet and enter a valid Intent ID");
      return;
    }

    setCancelLoading(true);
    setCancelResult("");

    try {
      const provider = new BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();
      const auctionHub = getAuctionHubContract(signer);
      const result = await auctionHub.cancelAuction(cancelIntentId);
      
      setCancelResult(`Auction cancelled successfully! Transaction hash: ${result.hash}`);
      setCancelIntentId("");
    } catch (error: any) {
      console.error('Error cancelling auction:', error);
      setCancelResult(`Error: ${error.reason || error.message || 'Failed to cancel auction'}`);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleViewAuction = async () => {
    if (!walletClient || !viewIntentId.trim()) {
      setViewError("Please connect wallet and enter a valid Intent ID");
      return;
    }

    setViewLoading(true);
    setViewError("");
    setAuctionDetails(null);

    try {
      const provider = new BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();
      const auctionHub = getAuctionHubContract(signer);
      const auction = await auctionHub.getAuction(viewIntentId);
      
      // Format the auction details
      const formattedAuction: AuctionDetails = {
        intentId: auction.intentId,
        seller: auction.seller,
        nftContract: auction.nftContract,
        tokenId: auction.tokenId.toString(),
        startingPrice: ethers.formatEther(auction.startingPrice),
        reservePrice: ethers.formatEther(auction.reservePrice),
        deadline: new Date(Number(auction.deadline) * 1000).toLocaleString(),
        preferdToken: auction.preferdToken,
        preferdChain: Number(auction.preferdChain),
        highestBidder: auction.highestBidder,
        highestBid: ethers.formatEther(auction.highestBid),
        status: Number(auction.status)
      };

      setAuctionDetails(formattedAuction);
    } catch (error: any) {
      console.error('Error fetching auction:', error);
      setViewError(`Error: ${error.reason || error.message || 'Failed to fetch auction details'}`);
    } finally {
      setViewLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    if (!address || address === '0x0000000000000000000000000000000000000000') return 'None';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <div className="backdrop-blur-sm bg-red-500/10 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-red-300 font-semibold mb-2">⚠️ Wallet Not Connected</h3>
        <p className="text-red-300/80">Please connect your wallet to use auction testing tools.</p>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-sm bg-white/5 rounded-2xl p-8 border border-white/10 space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">🧪 Auction Testing Panel</h2>
        <p className="text-white/70">Test auction operations with intent IDs</p>
      </div>

      {/* Cancel Auction Section */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="text-xl font-semibold text-white mb-4">Cancel Auction</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm mb-2">Intent ID</label>
            <input
              type="text"
              value={cancelIntentId}
              onChange={(e) => setCancelIntentId(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <button
            onClick={handleCancelAuction}
            disabled={cancelLoading || !cancelIntentId.trim()}
            className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {cancelLoading ? 'Cancelling...' : 'Cancel Auction'}
          </button>

          {cancelResult && (
            <div className={`p-4 rounded-lg ${
              cancelResult.includes('Error') 
                ? 'bg-red-500/10 border border-red-500/20 text-red-300' 
                : 'bg-green-500/10 border border-green-500/20 text-green-300'
            }`}>
              <p className="text-sm break-all">{cancelResult}</p>
            </div>
          )}
        </div>
      </div>

      {/* View Auction Section */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        <h3 className="text-xl font-semibold text-white mb-4">View Auction Details</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-white/70 text-sm mb-2">Intent ID</label>
            <input
              type="text"
              value={viewIntentId}
              onChange={(e) => setViewIntentId(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <button
            onClick={handleViewAuction}
            disabled={viewLoading || !viewIntentId.trim()}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {viewLoading ? 'Loading...' : 'View Auction'}
          </button>

          {viewError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-300 text-sm break-all">{viewError}</p>
            </div>
          )}

          {auctionDetails && (
            <div className="bg-white/5 rounded-lg p-6 border border-white/10 space-y-4">
              <h4 className="text-lg font-semibold text-white">Auction Details</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/70">Intent ID:</span>
                  <p className="text-white font-mono text-xs break-all">{auctionDetails.intentId}</p>
                </div>
                
                <div>
                  <span className="text-white/70">Status:</span>
                  <p className="text-white">
                    <span className={`px-2 py-1 rounded text-xs ${
                      auctionDetails.status === 1 ? 'bg-green-500/20 text-green-300' :
                      auctionDetails.status === 4 ? 'bg-red-500/20 text-red-300' :
                      auctionDetails.status === 3 ? 'bg-blue-500/20 text-blue-300' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {AuctionStatus[auctionDetails.status as keyof typeof AuctionStatus]}
                    </span>
                  </p>
                </div>

                <div>
                  <span className="text-white/70">Seller:</span>
                  <p className="text-white font-mono">{formatAddress(auctionDetails.seller)}</p>
                </div>

                <div>
                  <span className="text-white/70">NFT Contract:</span>
                  <p className="text-white font-mono">{formatAddress(auctionDetails.nftContract)}</p>
                </div>

                <div>
                  <span className="text-white/70">Token ID:</span>
                  <p className="text-white">{auctionDetails.tokenId}</p>
                </div>

                <div>
                  <span className="text-white/70">Starting Price:</span>
                  <p className="text-white">{auctionDetails.startingPrice} ETH</p>
                </div>

                <div>
                  <span className="text-white/70">Reserve Price:</span>
                  <p className="text-white">{auctionDetails.reservePrice} ETH</p>
                </div>

                <div>
                  <span className="text-white/70">Deadline:</span>
                  <p className="text-white">{auctionDetails.deadline}</p>
                </div>

                <div>
                  <span className="text-white/70">Preferred Chain:</span>
                  <p className="text-white">
                    {CHAIN_NAMES[auctionDetails.preferdChain as keyof typeof CHAIN_NAMES] || `Chain ${auctionDetails.preferdChain}`}
                  </p>
                </div>

                <div>
                  <span className="text-white/70">Preferred Token:</span>
                  <p className="text-white font-mono">{formatAddress(auctionDetails.preferdToken)}</p>
                </div>

                <div>
                  <span className="text-white/70">Highest Bidder:</span>
                  <p className="text-white font-mono">{formatAddress(auctionDetails.highestBidder)}</p>
                </div>

                <div>
                  <span className="text-white/70">Highest Bid:</span>
                  <p className="text-white">{auctionDetails.highestBid} ETH</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}