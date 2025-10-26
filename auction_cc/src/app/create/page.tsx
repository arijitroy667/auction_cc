"use client";

import { useState, useEffect } from "react";
import { useAccount, useWalletClient, useChainId } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import { useNotification } from "@blockscout/app-sdk";
import Navbar from "@/components/navbar";
import Link from "next/link";
import { ethers } from "ethers";
import { getAuctionHubContract } from "@/lib/auctionHub";
import { useRouter } from "next/navigation";
import NFTSelector from "@/components/NFTSelector";
import { toast, Toaster } from "react-hot-toast";

import {
  SUPPORTED_TOKENS,
  CHAIN_NAMES,
  TOKEN_ADDRESSES,
  AUCTION_HUB_ADDRESS,
  type SupportedToken,
} from "@/lib/constants";

export default function CreateAuctionPage() {
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const router = useRouter();
  const [initialized, setInitialized] = useState(isInitialized());
  const [isCreating, setIsCreating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const { openTxToast } = useNotification();

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

  const truncateError = (msg: string, maxLength = 80) => {
    return msg.length > maxLength ? msg.slice(0, maxLength) + "..." : msg;
  };

  // Handler for NFT selection
  const handleNFTSelect = (contractAddress: string, tokenId: string) => {
    setAuctionForm({
      ...auctionForm,
      nftContract: contractAddress,
      tokenId: tokenId,
    });
  };

  const handleApproveNFT = async () => {
    if (!isConnected || !auctionForm.nftContract || !walletClient) {
      toast.error(
        "Please connect your wallet and enter NFT contract address first"
      );
      return;
    }

    setIsApproving(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const currentChainId = Number(
        (await provider.getNetwork()).chainId
      ).toString();

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
        toast.success("NFT contract is already approved for the AuctionHub");
        return;
      }

      // Approve the auction contract to transfer all NFTs
      const tx = await nftContract.setApprovalForAll(AUCTION_HUB_ADDRESS, true);
      await openTxToast(currentChainId, tx.hash);
      await tx.wait();

      
    } catch (error: unknown) {
      console.error("Error approving NFT:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to approve NFT: ${truncateError(errorMessage)}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleCreateAuction = async () => {
    if (!isConnected || !initialized) {
      toast.error("Please connect your wallet and initialize Nexus first");
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
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate duration (minimum 2 minutes)
    const durationMinutes = parseFloat(auctionForm.durationHours) * 60;
    if (durationMinutes < 2) {
      toast.error("Auction duration must be at least 2 minutes");
      return;
    }

    // Validate that starting price is greater than reserve price
    const startingPriceNum = parseFloat(auctionForm.startingPrice);
    const reservePriceNum = parseFloat(auctionForm.reservePrice);

    if (isNaN(startingPriceNum) || isNaN(reservePriceNum)) {
      toast.error(
        "Please enter valid numeric values for highest and reserve prices"
      );
      return;
    }

    if (startingPriceNum <= reservePriceNum) {
      toast.error("Highest price must be greater than reserve price");
      return;
    }

    if (!walletClient) {
      toast.error("Wallet client not available");
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
          toast.error(
            `You don't own this NFT. Owner: ${owner.slice(
              0,
              6
            )}...${owner.slice(-4)}`
          );
          return;
        }
      } catch (error) {
        toast.error("Invalid NFT contract address or token ID");
        return;
      }

      // Check if the auction contract is approved
      const isApproved = await nftContract.isApprovedForAll(
        userAddress,
        AUCTION_HUB_ADDRESS
      );
      if (!isApproved) {
        toast.error(
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
      // Replace the confirm dialog with this:
      toast.success(`Auction created! ID: ${intentId.slice(0, 10)}...`, {
        duration: 3000,
      });
      toast(`Redirecting to "My Auctions" page...`, {
        duration: 4000,
        icon: "ℹ️",
      });

      // Automatically navigate after showing the messages
      setTimeout(() => {
        router.push("/my_auctions?from=create");
      }, 4500);

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
      toast.error(`Failed to create auction: ${truncateError(errorMessage)}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1a1a1a",
            color: "#fff",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />

      {/* Background Grid */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      {/* Status messages */}
      {/* Fixed Status Indicator - Top Right */}
      <div className="fixed top-20 right-6 z-50 ">
        {/* Not Connected */}
        {!isConnected && (
          <div className="bg-gradient-to-r from-yellow-800/90 to-yellow-700/90 backdrop-blur-xl border border-yellow-500/50 rounded-full px-5 py-2.5 shadow-xl shadow-yellow-500/30 transition-all duration-300 group cursor-default">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse" />
              <div className="text-sm">
                <p className="text-yellow-200 font-semibold">Not Connected</p>
              </div>
            </div>
          </div>
        )}

        {/* Connected but not Initialized */}
        {isConnected && !initialized && (
          <div className="bg-gradient-to-r from-blue-800/90 to-blue-700/90 backdrop-blur-xl border border-blue-500/50 rounded-full px-5 py-2.5 shadow-xl shadow-blue-500/30 transition-all duration-300 group cursor-default">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse" />
              <div className="text-sm">
                <p className="text-blue-200 font-semibold">Initialize Nexus</p>
              </div>
            </div>
          </div>
        )}
      </div>
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

            {/* Form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Form Fields */}
              <div className="space-y-6">
                {/* NFT Selector Section */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Select Your NFT *
                  </label>
                  {isConnected && address ? (
                    <NFTSelector
                      userAddress={address}
                      chainId={chainId}
                      onSelectNFT={handleNFTSelect}
                      selectedNFT={
                        auctionForm.nftContract && auctionForm.tokenId
                          ? {
                              contractAddress: auctionForm.nftContract,
                              tokenId: auctionForm.tokenId,
                            }
                          : undefined
                      }
                    />
                  ) : (
                    <div className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white/50 text-center">
                      Connect your wallet to view your NFTs
                    </div>
                  )}
                  <p className="text-xs text-zinc-400 mt-2">
                    Select an NFT from your wallet or enter details manually
                    below
                  </p>
                </div>

                {/* Manual Entry Option */}
                <div className="border-t border-white/10 pt-4">
                  <p className="text-white/60 text-sm mb-3">
                    Or enter manually:
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">
                        NFT Contract Address
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
                      <label className="block text-white/70 text-sm font-medium mb-2">
                        Token ID
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
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Highest Price *{" "}
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
                    Minimum acceptable price (must be less than highest price)
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
                        toast.error("Minimum auction duration is 2 minutes");
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
                      30 min
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
                      1 hr
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
                      2 hr
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAuctionForm({ ...auctionForm, durationHours: "1" })
                      }
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-xs hover:bg-blue-500/30"
                    >
                      5 hour
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
                    Highest price must be greater than reserve price
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              {/* Approve Button */}
              <button
                onClick={handleApproveNFT}
                disabled={
                  !isConnected || !auctionForm.nftContract || isApproving
                }
                className={`relative group px-10 py-3 rounded-xl font-bold overflow-hidden cursor-pointer border border-gray-400/30 transition-all duration-300 transform ${
                  isConnected && auctionForm.nftContract && !isApproving
                    ? "bg-gradient-to-r from-black via-gray-900/45 to-gray-600/30 text-white hover:from-black hover:via-black hover:to-black hover:scale-105 shadow-xl shadow-gray-500/50 hover:shadow-2xl hover:shadow-gray-500/70"
                    : "bg-black/50 text-white/50 cursor-not-allowed border-white/10"
                }`}
              >
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  {isApproving ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              </button>

              {/* Create Auction Button */}
              <button
                onClick={handleCreateAuction}
                disabled={!isConnected || !initialized || isCreating}
                className={`relative group px-12 py-4 rounded-xl font-bold overflow-hidden cursor-pointer border border-gray-400/30 transition-all duration-300 transform ${
                  isConnected && initialized && !isCreating
                    ? "bg-gradient-to-r from-black via-gray-900/45 to-gray-600/30 text-white hover:from-black hover:via-black hover:to-black hover:scale-105 shadow-xl shadow-gray-500/50 hover:shadow-2xl hover:shadow-gray-500/70"
                    : "bg-black/50 text-white/50 cursor-not-allowed border-white/10"
                }`}
              >
                <span className="relative z-10 flex items-center justify-center space-x-2">
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
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
