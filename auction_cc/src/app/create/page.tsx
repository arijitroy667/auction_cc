"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import Navbar from "@/components/navbar";
import Link from "next/link";
import { ethers } from "ethers";
import { getAuctionHubContract } from "@/lib/auctionHub";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_TOKENS,
  CHAIN_NAMES,
  TOKEN_ADDRESSES,
  AUCTION_HUB_ADDRESS,
  type SupportedToken,
} from "@/lib/constants";

export default function CreateAuctionPage() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const router = useRouter();
  const [initialized, setInitialized] = useState(isInitialized());
  const [isCreating, setIsCreating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Auction form state - Default to 2 minutes
  const [auctionForm, setAuctionForm] = useState({
    nftContract: "",
    tokenId: "",
    startingPrice: "",
    reservePrice: "",
    durationHours: "0.033", // 2 minutes = 0.033 hours (2/60)
    preferdToken: "" as SupportedToken | "",
    preferdChain: "1",
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

  const handleApproveNFT = async () => {
    if (!isConnected || !auctionForm.nftContract || !walletClient) {
      alert("Please connect your wallet and enter NFT contract address first");
      return;
    }

    setIsApproving(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // ERC721 ABI for approve and setApprovalForAll
      const erc721ABI = [
        "function setApprovalForAll(address operator, bool approved)",
        "function isApprovedForAll(address owner, address operator) view returns (bool)",
        "function ownerOf(uint256 tokenId) view returns (address)",
        "function approve(address to, uint256 tokenId)",
      ];

      const nftContract = new ethers.Contract(
        auctionForm.nftContract,
        erc721ABI,
        signer
      );
      const userAddress = await signer.getAddress();

      // Check if already approved for all
      const isApproved = await nftContract.isApprovedForAll(
        userAddress,
        AUCTION_HUB_ADDRESS
      );

      if (isApproved) {
        alert("NFT contract is already approved for the AuctionHub");
        return;
      }

      // Approve the auction contract to transfer all NFTs
      const tx = await nftContract.setApprovalForAll(AUCTION_HUB_ADDRESS, true);
      await tx.wait();

      alert("NFT contract approved successfully! You can now create auctions.");
    } catch (error: unknown) {
      console.error("Error approving NFT:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to approve NFT: ${errorMessage}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreateAuction = async () => {
    if (!isConnected || !initialized) {
      alert("Please connect your wallet and initialize Nexus first");
      return;
    }

    if (
      !auctionForm.nftContract ||
      !auctionForm.tokenId ||
      !auctionForm.startingPrice ||
      !auctionForm.reservePrice ||
      !auctionForm.durationHours ||
      !auctionForm.preferdToken
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Validate duration (minimum 2 minutes)
    const durationMinutes = parseFloat(auctionForm.durationHours) * 60;
    if (durationMinutes < 2) {
      alert("Auction duration must be at least 2 minutes");
      return;
    }

    // Validate that starting price is greater than reserve price
    const startingPriceNum = parseFloat(auctionForm.startingPrice);
    const reservePriceNum = parseFloat(auctionForm.reservePrice);

    if (isNaN(startingPriceNum) || isNaN(reservePriceNum)) {
      alert(
        "Please enter valid numeric values for starting and reserve prices"
      );
      return;
    }

    if (startingPriceNum <= reservePriceNum) {
      alert("Starting price must be greater than reserve price");
      return;
    }

    if (!walletClient) {
      alert("Wallet client not available");
      return;
    }

    setIsCreating(true);

    try {
      // Create ethers signer from wallet client
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Check if the NFT is approved for the auction contract
      const erc721ABI = [
        "function isApprovedForAll(address owner, address operator) view returns (bool)",
        "function ownerOf(uint256 tokenId) view returns (address)",
      ];

      const nftContract = new ethers.Contract(
        auctionForm.nftContract,
        erc721ABI,
        signer
      );

      // Check if user owns the NFT
      try {
        const owner = await nftContract.ownerOf(auctionForm.tokenId);
        if (owner.toLowerCase() !== userAddress.toLowerCase()) {
          alert(`You don't own this NFT. Current owner: ${owner}`);
          return;
        }
      } catch (error) {
        alert("Invalid NFT contract address or token ID");
        return;
      }

      // Check if the auction contract is approved
      const isApproved = await nftContract.isApprovedForAll(
        userAddress,
        AUCTION_HUB_ADDRESS
      );
      if (!isApproved) {
        alert(
          'Please approve the NFT contract first by clicking "Approve NFT Contract" button'
        );
        return;
      }

      // Get contract instance
      const auctionHubContract = getAuctionHubContract(signer);

      // Calculate deadline - convert hours to seconds
      const deadline =
        Math.floor(Date.now() / 1000) +
        parseFloat(auctionForm.durationHours) * 3600;

      // Create auction parameters
      const params = {
        nftContract: auctionForm.nftContract,
        tokenId: auctionForm.tokenId,
        startingPrice: auctionForm.startingPrice,
        reservePrice: auctionForm.reservePrice,
        deadline,
        preferdToken: auctionForm.preferdToken as SupportedToken,
        preferdChain: parseInt(auctionForm.preferdChain),
      };

      console.log("Creating auction with params:", params);

      // Create the auction
      const intentId = await auctionHubContract.createAuction(params);

      // Show success message with options
      const userChoice = confirm(
        `Auction created successfully! Intent ID: ${intentId}\n\n` +
          `Your auction may take a few moments to appear in "My Auctions" as our keeper processes the blockchain event.\n\n` +
          `Would you like to go to "My Auctions" page now?`
      );

      if (userChoice) {
        // Navigate to My Auctions page with parameter
        router.push("/my_auctions?from=create");
      }

      console.log("Auction created with Intent ID:", intentId);

      // Reset form
      setAuctionForm({
        nftContract: "",
        tokenId: "",
        startingPrice: "",
        reservePrice: "",
        durationHours: "0.033", // Reset to 2 minutes default
        preferdToken: "",
        preferdChain: "1",
      });
    } catch (error: unknown) {
      console.error("Error creating auction:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to create auction: ${errorMessage}`);
    } finally {
      setIsCreating(false);
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
                <h1 className="text-4xl font-bold text-white mb-2">
                  Create Auction
                </h1>
                <p className="text-white/70">
                  List your NFT for auction across multiple blockchains (2min
                  minimum)
                </p>
              </div>
              <Link
                href="/auctions"
                className="px-6 py-3 bg-white/10 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
              >
                Browse Auctions
              </Link>
            </div>

            {/* Test Mode for Development */}
            {process.env.NODE_ENV === "development" && (
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <h3 className="text-yellow-300 font-semibold mb-2">
                  🧪 Test Mode
                </h3>
                <p className="text-yellow-300/70 text-sm mb-3">
                  Quick setup for testing short auctions
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAuctionForm({
                      ...auctionForm,
                      nftContract: "0x1234567890123456789012345678901234567890", // Example NFT
                      tokenId: "1",
                      startingPrice: "1",
                      reservePrice: "5",
                      durationHours: (2 / 60).toString(), // 2 minutes
                    });
                  }}
                  className="px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded font-medium hover:bg-yellow-500/30"
                >
                  Fill Test Data (2min auction)
                </button>
              </div>
            )}

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
                    onChange={(e) =>
                      setAuctionForm({
                        ...auctionForm,
                        nftContract: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      setAuctionForm({
                        ...auctionForm,
                        tokenId: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Starting Price *{" "}
                    <span className="text-blue-400 text-sm">(in USD)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0.1"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.startingPrice}
                    onChange={(e) =>
                      setAuctionForm({
                        ...auctionForm,
                        startingPrice: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Must be greater than reserve price
                  </p>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Reserve Price *{" "}
                    <span className="text-blue-400 text-sm">(in USD)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="1.0"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.reservePrice}
                    onChange={(e) =>
                      setAuctionForm({
                        ...auctionForm,
                        reservePrice: e.target.value,
                      })
                    }
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Minimum acceptable price (must be less than starting price)
                  </p>
                </div>
              </div>

              {/* Right Column - Additional Settings */}
              <div className="space-y-6">
                <div>
                  <label className="block text-white/70 text-sm font-medium mb-2">
                    Duration (Minutes) *
                  </label>
                  <input
                    type="number"
                    min="2" // Minimum 2 minutes
                    max="10080" // Maximum 7 days in minutes
                    step="1"
                    placeholder="2"
                    value={
                      auctionForm.durationHours
                        ? Math.round(
                            parseFloat(auctionForm.durationHours) * 60
                          ).toString()
                        : ""
                    }
                    onChange={(e) => {
                      const minutes = parseFloat(e.target.value) || 0;
                      if (minutes < 2 && minutes > 0) {
                        alert("Minimum auction duration is 2 minutes");
                        return;
                      }
                      const hours =
                        minutes > 0 ? (minutes / 60).toString() : "";
                      setAuctionForm({ ...auctionForm, durationHours: hours });
                    }}
                    className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-white/40 focus:bg-white/10"
                  />
                  <p className="text-white/50 text-sm mt-1">
                    Auction will run for{" "}
                    {auctionForm.durationHours
                      ? Math.round(parseFloat(auctionForm.durationHours) * 60)
                      : 0}{" "}
                    minutes (minimum 2 minutes)
                  </p>

                  {/* Quick duration buttons */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setAuctionForm({
                          ...auctionForm,
                          durationHours: (2 / 60).toString(),
                        })
                      }
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
                    >
                      2 min
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAuctionForm({
                          ...auctionForm,
                          durationHours: (5 / 60).toString(),
                        })
                      }
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
                    >
                      5 min
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAuctionForm({
                          ...auctionForm,
                          durationHours: (10 / 60).toString(),
                        })
                      }
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
                    >
                      10 min
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAuctionForm({
                          ...auctionForm,
                          durationHours: (30 / 60).toString(),
                        })
                      }
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
                    >
                      30 min
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAuctionForm({ ...auctionForm, durationHours: "1" })
                      }
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
                    >
                      1 hour
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Preferred Token *
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.preferdToken}
                    onChange={(e) =>
                      setAuctionForm({
                        ...auctionForm,
                        preferdToken: e.target.value as SupportedToken | "",
                      })
                    }
                  >
                    <option value="">Select preferred token</option>
                    {SUPPORTED_TOKENS.map((token) => (
                      <option
                        key={token}
                        value={token}
                        className="bg-black text-white"
                      >
                        {token}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Preferred Chain
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white backdrop-blur-sm focus:outline-none focus:border-blue-400 transition-colors"
                    value={auctionForm.preferdChain}
                    onChange={(e) =>
                      setAuctionForm({
                        ...auctionForm,
                        preferdChain: e.target.value,
                      })
                    }
                  >
                    {Object.entries(CHAIN_NAMES).map(([chainId, chainName]) => (
                      <option
                        key={chainId}
                        value={chainId}
                        className="bg-black text-white"
                      >
                        {chainName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Token Contract Address Display */}
                {auctionForm.preferdToken && auctionForm.preferdChain && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg backdrop-blur-sm">
                    <h5 className="text-blue-300 font-medium mb-2">
                      Token Contract Address:
                    </h5>
                    <p className="text-white/70 text-sm font-mono break-all">
                      {TOKEN_ADDRESSES[
                        parseInt(
                          auctionForm.preferdChain
                        ) as keyof typeof TOKEN_ADDRESSES
                      ]?.[auctionForm.preferdToken as SupportedToken] ||
                        "Unknown"}
                    </p>
                    <p className="text-white/50 text-xs mt-1">
                      {auctionForm.preferdToken} on{" "}
                      {
                        CHAIN_NAMES[
                          parseInt(
                            auctionForm.preferdChain
                          ) as keyof typeof CHAIN_NAMES
                        ]
                      }
                    </p>
                  </div>
                )}

                {/* NFT Preview */}
                <div className="mt-8">
                  <label className="block text-white font-medium mb-2">
                    NFT Preview
                  </label>
                  <div className="w-full h-48 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border border-white/20 flex items-center justify-center">
                    <span className="text-white/50">
                      NFT preview will appear here
                    </span>
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
                  You must own the NFT at the specified contract address and
                  token ID
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  The NFT will be transferred to the auction contract during
                  creation
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <strong className="text-white">
                    Starting price must be greater than reserve price
                  </strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <strong className="text-orange-300">
                    Minimum auction duration is 2 minutes
                  </strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  Only USDT and USDC tokens are supported for auctions
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  Ensure the auction deadline is in the future
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  Connect your wallet and initialize Nexus before creating an
                  auction
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <strong className="text-white">IMPORTANT:</strong> You must
                  click "Approve NFT Contract" before creating the auction
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              {/* Approve Button */}
              <div className="relative inline-flex group">
                <div
                  className={`absolute transition-all duration-1000 opacity-70 -inset-px rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 ${
                    isConnected && auctionForm.nftContract && !isApproving
                      ? "bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"
                      : "bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600"
                  }`}
                ></div>
                <button
                  onClick={handleApproveNFT}
                  disabled={
                    !isConnected || !auctionForm.nftContract || isApproving
                  }
                  className={`relative inline-flex items-center justify-center px-8 py-3 text-sm font-bold duration-200 rounded-xl border ${
                    isConnected && auctionForm.nftContract && !isApproving
                      ? "text-white bg-black border-white/20 hover:bg-black/90"
                      : "text-white/50 bg-black/50 border-white/10 cursor-not-allowed"
                  }`}
                >
                  {isApproving ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Approving...
                    </>
                  ) : (
                    "Approve NFT Contract"
                  )}
                </button>
              </div>

              {/* Create Button */}
              <div className="relative inline-flex group">
                <div
                  className={`absolute transition-all duration-1000 opacity-70 -inset-px rounded-xl blur-lg group-hover:opacity-100 group-hover:-inset-1 group-hover:duration-200 ${
                    isConnected && initialized && !isCreating
                      ? "bg-gradient-to-r from-white via-gray-300 to-white"
                      : "bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600"
                  }`}
                ></div>
                <button
                  onClick={handleCreateAuction}
                  disabled={!isConnected || !initialized || isCreating}
                  className={`relative inline-flex items-center justify-center px-12 py-4 text-lg font-bold duration-200 rounded-xl border ${
                    isConnected && initialized && !isCreating
                      ? "text-white bg-black border-white/20 hover:bg-black/90"
                      : "text-white/50 bg-black/50 border-white/10 cursor-not-allowed"
                  }`}
                >
                  {isCreating ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Creating Auction...
                    </>
                  ) : !isConnected ? (
                    "Connect Wallet First"
                  ) : !initialized ? (
                    "Initialize Nexus First"
                  ) : (
                    "Create Auction"
                  )}
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
