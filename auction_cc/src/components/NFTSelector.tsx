"use client";

import { useState, useEffect } from "react";
import {
  fetchUserNFTsFromAlchemy,
  type NFTMetadata,
} from "@/lib/fetchUserNFTs";

interface NFTSelectorProps {
  userAddress: string;
  chainId: number;
  onSelectNFT: (contractAddress: string, tokenId: string) => void;
  selectedNFT?: { contractAddress: string; tokenId: string };
}

export default function NFTSelector({
  userAddress,
  chainId,
  onSelectNFT,
  selectedNFT,
}: NFTSelectorProps) {
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  const fetchNFTs = async () => {
    setLoading(true);
    setError(null);
    setNfts([]);

    try {
      let fetchedNFTs: NFTMetadata[] = [];

      if (ALCHEMY_API_KEY) {
        try {
          fetchedNFTs = await fetchUserNFTsFromAlchemy(
            userAddress,
            chainId,
            ALCHEMY_API_KEY
          );
          console.log(`Fetched ${fetchedNFTs.length} NFTs from Alchemy`);
        } catch (error) {
          console.error("Alchemy fetch failed:", error);
        }
      }

      if (fetchedNFTs.length === 0 && !ALCHEMY_API_KEY) {
        setError(
          "No NFT API keys configured."
        );
      } else if (fetchedNFTs.length === 0) {
        setError("No NFTs found on this chain for your address.");
      } else {
        setNfts(fetchedNFTs);
      }
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch NFTs"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNFT = (nft: NFTMetadata) => {
    onSelectNFT(nft.contractAddress, nft.tokenId);
    setShowModal(false);
  };

  return (
    <div>
      {/* Select NFT Button */}
      <button
        type="button"
        onClick={() => {
          setShowModal(true);
          if (nfts.length === 0 && !loading) {
            fetchNFTs();
          }
        }}
        className="w-full px-4 py-3 bg-blue-500/20 border border-blue-400/40 rounded-lg text-blue-300 font-medium hover:bg-blue-500/30 transition-colors"
      >
        {selectedNFT
          ? `Selected: ${selectedNFT.contractAddress.slice(0, 6)}...${selectedNFT.contractAddress.slice(-4)} #${selectedNFT.tokenId}`
          : "🖼️ Select from My NFTs"}
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[80vh] bg-zinc-900 rounded-2xl border border-white/20 overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-zinc-900 border-b border-white/10 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Select Your NFT
                  </h2>
                  <p className="text-white/60 text-sm mt-1">
                    Choose an NFT from your wallet to auction
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchNFTs}
                disabled={loading}
                className="mt-4 px-4 py-2 bg-blue-500/20 border border-blue-400/40 rounded-lg text-blue-300 text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh NFTs"}
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(80vh - 140px)" }}>
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-white/60 mt-4">Loading your NFTs...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-300 text-sm">{error}</p>
                  {!ALCHEMY_API_KEY && (
                    <div className="mt-3 text-xs text-red-200/80">
                      <p className="font-semibold mb-2">Setup Instructions:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>
                          Sign up for a free API key at{" "}
                          <a
                            href="https://www.alchemy.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                          >
                            Alchemy
                          </a>{" "}
                        </li>
                        <li>
                          Create a <code>.env.local</code> file in your project
                          root
                        </li>
                        <li>
                          Add:{" "}
                          <code>NEXT_PUBLIC_ALCHEMY_API_KEY=your_key_here</code>
                        </li>
                        <li>Restart your development server</li>
                      </ol>
                    </div>
                  )}
                </div>
              )}

              {!loading && !error && nfts.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🖼️</div>
                  <p className="text-white/60">No NFTs found on this chain</p>
                  <p className="text-white/40 text-sm mt-2">
                    Make sure you have NFTs on the currently connected network
                  </p>
                </div>
              )}

              {/* NFT Grid */}
              {nfts.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {nfts.map((nft, index) => (
                    <button
                      key={`${nft.contractAddress}-${nft.tokenId}-${index}`}
                      onClick={() => handleSelectNFT(nft)}
                      className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-blue-400/50 transition-all hover:scale-105"
                    >
                      {/* NFT Image */}
                      <div className="aspect-square bg-zinc-800 relative">
                        {nft.image ? (
                          <img
                            src={nft.image}
                            alt={nft.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23333'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23666' font-size='40'%3E%3F%3C/text%3E%3C/svg%3E";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">
                            🖼️
                          </div>
                        )}
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/20 transition-colors flex items-center justify-center">
                          <span className="text-white font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                            Select
                          </span>
                        </div>
                      </div>

                      {/* NFT Info */}
                      <div className="p-3">
                        <p className="text-white font-medium text-sm truncate">
                          {nft.name}
                        </p>
                        <p className="text-white/40 text-xs truncate">
                          {nft.collectionName}
                        </p>
                        <p className="text-white/60 text-xs mt-1">
                          Token #{nft.tokenId}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
