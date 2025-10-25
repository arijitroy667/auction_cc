"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import { useNotification } from "@blockscout/app-sdk";
import Navbar from "@/components/navbar";
import Link from "next/link";
import { ethers } from "ethers";
import { getAuctionHubContract } from "@/lib/auctionHub";
import { detectPendingClaim } from "@/lib/claimDetection";
import { result as bridgeTokens } from "@/components/bridge/bridge";
import { sdk } from "@/lib/nexus/nexusClient";
import { toast, Toaster } from "react-hot-toast";
import { TOKEN_ADDRESSES } from "@/lib/constants";
import type {
  BridgeAndExecuteParams,
  BridgeAndExecuteResult,
} from "@avail-project/nexus-core";
// Import Nexus swap for mainnet deployment
// import { swapTokens } from '@/components/swap/swap';

// Uniswap SwapRouter02 addresses for each chain
const UNISWAP_SWAP_ROUTER02_ADDRESSES: { [chainId: number]: string } = {
  11155111: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // Ethereum Sepolia
  421614: "0x101F443B4d1b059569D643917553c771E1b9663E",   // Arbitrum Sepolia
  84532: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",    // Base Sepolia
  11155420: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",  // Optimism Sepolia
};

const KEEPER_API_URL = process.env.NEXT_PUBLIC_KEEPER_API_URL || "http://localhost:3001";

// SwapRouter02 ABI for exactInputSingle function
const SWAP_ROUTER02_ABI = [
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "tokenIn", type: "address" },
          { internalType: "address", name: "tokenOut", type: "address" },
          { internalType: "uint24", name: "fee", type: "uint24" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint256", name: "amountIn", type: "uint256" },
          {
            internalType: "uint256",
            name: "amountOutMinimum",
            type: "uint256",
          },
          {
            internalType: "uint160",
            name: "sqrtPriceLimitX96",
            type: "uint160",
          },
        ],
        internalType: "struct IV3SwapRouter.ExactInputSingleParams",
        name: "params",
        type: "tuple",
      },
    ],
    name: "exactInputSingle",
    outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
];

function getSwapRouter02Address(chainId: number): string {
  const routerAddress = UNISWAP_SWAP_ROUTER02_ADDRESSES[chainId];
  if (!routerAddress) {
    throw new Error(`Uniswap SwapRouter02 not available on chain ${chainId}`);
  }
  return routerAddress;
}

function getTokenAddress(chainId: number, symbol: string): string {
  const chainAddresses =
    TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES];
  if (!chainAddresses) {
    throw new Error(`Chain ${chainId} not supported`);
  }
  const tokenAddress = chainAddresses[symbol as keyof typeof chainAddresses];
  if (!tokenAddress) {
    throw new Error(`Token ${symbol} not found on chain ${chainId}`);
  }
  return tokenAddress;
}

interface Auction {
  intentId: string;
  seller: string;
  nftContract: string;
  tokenId: string;
  startingPrice: string;
  reservePrice: string;
  deadline: string;
  preferdToken: string;
  preferdChain: string;
  sourceChain: string;
  status: number;
  txHash: string;
  timestamp: string;
}

interface Bid {
  intentId: string;
  bidder: string;
  amount: string;
  token: string;
  sourceChain: string;
  transactionHash: string;
  timestamp: string;
}

interface KeeperAuctionsResponse {
  success: boolean;
  count: number;
  data: Auction[];
  timestamp: string;
}

interface KeeperBidsResponse {
  success: boolean;
  count: number;
  data: Bid[];
  timestamp: string;
}

const CHAIN_NAMES: { [key: string]: string } = {
  ethereum: "Ethereum Sepolia",
  arbitrumSepolia: "Arbitrum Sepolia",
  base: "Base Sepolia",
  optimism: "Optimism Sepolia",
};

// Map chain names to chain IDs
const CHAIN_NAME_TO_ID: { [key: string]: number } = {
  ethereum: 11155111,
  arbitrumSepolia: 421614,
  base: 84532,
  optimism: 11155420,
};

const STATUS_NAMES = {
  0: "Created",
  1: "Active",
  2: "Finalized",
  3: "Settled",
  4: "Claimed",
  5: "Cancelled",
};

export default function MyAuctionsPage() {
  const { isConnected, address } = useAccount();
  const currentChainId = useChainId();
  const [initialized, setInitialized] = useState(isInitialized());
  const [myAuctions, setMyAuctions] = useState<Auction[]>([]);
  const [auctionBids, setAuctionBids] = useState<{ [key: string]: Bid[] }>({});
  const [claimingAuction, setClaimingAuction] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = useState<{ [intentId: string]: any }>({});
  const [locallyClaimedAuctions, setLocallyClaimedAuctions] = useState<Set<string>>(new Set());
  const { openTxToast } = useNotification();

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

  // Load locally claimed auctions from localStorage on mount
  useEffect(() => {
    try {
      const storedClaims = localStorage.getItem('claimedAuctions');
      if (storedClaims) {
        const claimsArray = JSON.parse(storedClaims);
        setLocallyClaimedAuctions(new Set(claimsArray));
      }
    } catch (error) {
      console.error("Error loading claimed auctions from localStorage:", error);
    }
  }, []);

  // Helper function to mark auction as claimed in localStorage
  const markAuctionAsClaimed = (intentId: string) => {
    try {
      const newClaimedSet = new Set(locallyClaimedAuctions);
      newClaimedSet.add(intentId);
      setLocallyClaimedAuctions(newClaimedSet);
      
      // Save to localStorage
      localStorage.setItem('claimedAuctions', JSON.stringify(Array.from(newClaimedSet)));
      console.log(`[LocalStorage] Marked auction ${intentId} as claimed`);
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  };

  const fetchMyAuctions = async () => {
    if (!address) return;

    setLoading(true);
    setError(null);
    try {
      // Fetch all auctions
      const auctionsResponse = await fetch(`${KEEPER_API_URL}/api/auctions`);
      if (!auctionsResponse.ok) {
        throw new Error(
          `Failed to fetch auctions: ${auctionsResponse.statusText}`
        );
      }

      const auctionsData: KeeperAuctionsResponse =
        await auctionsResponse.json();

      if (auctionsData.success) {
        // Filter auctions by current user
        const userAuctions = auctionsData.data.filter(
          (auction) => auction.seller.toLowerCase() === address.toLowerCase()
        );

        setMyAuctions(userAuctions);

        // Fetch bids for each auction
        const bidsPromises = userAuctions.map(async (auction) => {
          try {
            const bidsResponse = await fetch(
              `${KEEPER_API_URL}/api/bids/${auction.intentId}`
            );
            if (bidsResponse.ok) {
              const bidsData: KeeperBidsResponse = await bidsResponse.json();
              return { auctionId: auction.intentId, bids: bidsData.data || [] };
            }
          } catch (error) {
            console.error(
              `Error fetching bids for auction ${auction.intentId}:`,
              error
            );
          }
          return { auctionId: auction.intentId, bids: [] };
        });

        const bidsResults = await Promise.all(bidsPromises);
        const bidsMap: { [key: string]: Bid[] } = {};
        bidsResults.forEach(({ auctionId, bids }) => {
          bidsMap[auctionId] = bids;
        });

        setAuctionBids(bidsMap);
      } else {
        throw new Error("Invalid response from keeper API");
      }
    } catch (error) {
      console.error("Error fetching my auctions:", error);
      setError(
        error instanceof Error ? error.message : "Failed to fetch auctions"
      );
      setMyAuctions([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelAuction = async (auction: Auction) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    const bids = auctionBids[auction.intentId] || [];
    if (bids.length > 0) {
      toast.error("Cannot cancel auction with existing bids");
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const deadline = parseInt(auction.deadline);
    if (deadline <= now) {
      toast.error("Cannot cancel auction that has already ended");
      return;
    }

    setCancelling(auction.intentId);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const auctionHubContract = getAuctionHubContract(signer);
      const currentChainId = Number(
        (await provider.getNetwork()).chainId
      ).toString();

      console.log("🔄 Sending cancel transaction...");
      console.log("Intent ID:", auction.intentId);

      // Call the cancelAuction method on the contract instance
      const receipt = await auctionHubContract.cancelAuction(auction.intentId);
      await openTxToast(currentChainId, receipt.hash);

      console.log("✅ Auction cancelled:", receipt.hash);

      // Immediately update the local state to show cancelled status
      setMyAuctions((prevAuctions) =>
        prevAuctions.map((a) =>
          a.intentId === auction.intentId
            ? { ...a, status: 3 } // Set to cancelled immediately
            : a
        )
      );

      toast.success(
        "Auction cancelled successfully! Your NFT has been returned."
      );

      setTimeout(() => {
        fetchMyAuctions();
      }, 3000); // Wait 3 seconds for keeper to process the event
    } catch (error: unknown) {
      console.error("Error cancelling auction:", error);

      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas";
        } else if (error.message.includes("Not the seller")) {
          errorMessage = "You are not the seller of this auction";
        } else if (error.message.includes("Auction not active")) {
          errorMessage = "Auction is not active";
        } else if (error.message.includes("Cannot cancel with bids")) {
          errorMessage = "Cannot cancel auction that has bids";
        } else if (error.message.includes("Auction ended")) {
          errorMessage = "Cannot cancel auction that has ended";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(`Failed to cancel auction: ${errorMessage}`);
    } finally {
      setCancelling(null);
    }
  };

  const handleClaim = async (auction: Auction) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!initialized) {
      toast.error(
        "Please initialize Nexus first to enable cross-chain operations"
      );
      return;
    }

    // Validate that user is on the correct chain (auction's source chain)
    const requiredChainId = CHAIN_NAME_TO_ID[auction.sourceChain];
    if (!requiredChainId) {
      toast.error(`Unknown chain: ${auction.sourceChain}`);
      return;
    }

    if (currentChainId !== requiredChainId) {
      const requiredChainName = CHAIN_NAMES[auction.sourceChain] || auction.sourceChain;
      toast.error(
        `Wrong network! Please switch to ${requiredChainName} to claim tokens from this auction.`,
        { duration: 5000 }
      );
      return;
    }

    const bids = auctionBids[auction.intentId] || [];
    const claim = detectPendingClaim(auction, bids, address);

    if (!claim) {
      return;
    }

    setClaimingAuction(auction.intentId);

    try {
      // STEP 0: Check on-chain status first to avoid revert
      console.log("[Claim] Step 0: Checking on-chain auction status...");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const auctionHubContract = getAuctionHubContract(signer);
      
      // Get current on-chain status
      const onChainAuction = await auctionHubContract.getAuction(auction.intentId);
      const currentStatus = Number(onChainAuction.status);
      
      console.log("[Claim] Current on-chain status:", currentStatus, {
        0: "Created",
        1: "Active",
        2: "Finalized",
        3: "Settled",
        4: "Claimed",
        5: "Cancelled"
      }[currentStatus]);

      // If already claimed, just refresh the UI
      if (currentStatus === 4) {
        console.log("[Claim] ⚠️ Auction already claimed on-chain");
        toast.success("This auction has already been claimed. Refreshing...");
        await fetchMyAuctions();
        setClaimingAuction(null);
        return;
      }

      // If not settled yet, cannot claim
      if (currentStatus !== 3) {
        console.log("[Claim] ⚠️ Auction is not in Settled status yet");
        toast.error(`Cannot claim: Auction status is ${currentStatus === 2 ? "Finalized (waiting for NFT release)" : "not settled yet"}. Please wait for the keeper to process.`);
        await fetchMyAuctions();
        setClaimingAuction(null);
        return;
      }

      const decimals = 6; // USDC/USDT decimals
      const bidAmount = claim.amount;
      const humanReadableAmount = Number(bidAmount) / 10 ** decimals;

      const sameChain = claim.currentChainId === claim.preferredChainId;
      const sameToken = claim.currentTokenSymbol === claim.preferredTokenSymbol;

      console.log("[Claim] Analyzing claim requirements:", {
        currentChain: claim.currentChainName,
        currentToken: claim.currentTokenSymbol,
        preferredChain: claim.preferredChainName,
        preferredToken: claim.preferredTokenSymbol,
        amount: humanReadableAmount,
        sameChain,
        sameToken,
      });

      // STEP 1: Call claimAuction on-chain to mark as claimed
      console.log("[Claim] Step 1: Marking auction as claimed on-chain...");
      const currentChainId = Number(
        (await provider.getNetwork()).chainId
      ).toString();

      const claimTx = await auctionHubContract.claimAuction(auction.intentId);
      console.log("[Claim] Claim transaction sent:", claimTx.hash);
      await openTxToast(currentChainId, claimTx.hash);
      await claimTx.wait();
      console.log("[Claim] ✓ Auction marked as claimed on-chain");

      // Immediately save to localStorage and update local state
      markAuctionAsClaimed(auction.intentId);

      // Immediately update local state to show claimed status
      setMyAuctions((prevAuctions) =>
        prevAuctions.map((a) =>
          a.intentId === auction.intentId
            ? { ...a, status: 4 } // Set to Claimed immediately
            : a
        )
      );

      // CASE 1: Same chain AND same token - No action needed
      if (sameChain && sameToken) {
        console.log(
          "[Claim] ✅ Funds already on correct chain with correct token - no action needed"
        );
        
        toast.success(
          `Auction claimed! Funds are already on ${claim.preferredChainName} with ${claim.preferredTokenSymbol}.`
        );
        setTimeout(() => fetchMyAuctions(), 2000);
        setClaimingAuction(null);
        return;
      }

      // CASE 2: Same chain BUT different token - Use Uniswap swap (Testnet)
      /**
       * For mainnet deployment, we will use Nexus Swap instead of Uniswap Router
       *
       *
       * if (sameChain && !sameToken) {
       *
       *   try {
       *     // Use Nexus SDK swapTokens function for same-chain token swap
       *     const swapResult = await swapTokens(
       *       claim.currentTokenSymbol,
       *       claim.preferredTokenSymbol,
       *       humanReadableAmount,
       *       claim.currentChainId
       *     );
       *
       *     if (swapResult && swapResult.success) {
       *       markClaimAsCompleted(auction.intentId);
       *       toast.success(`Successfully swapped ${humanReadableAmount} ${claim.currentTokenSymbol} to ${claim.preferredTokenSymbol} on ${claim.currentChainName} using Nexus Swap`);
       *       setTimeout(() => fetchMyAuctions(), 2000);
       *       return;
       *     } else {
       *       throw new Error('Nexus swap transaction failed');
       *     }
       *   } catch (error) {
       *     console.error('[Claim] Nexus Swap error:', error);
       *     throw error;
       *   }
       * }
       *
       */

      // Since avail nexus swap is not yet available on testnet, we use Uniswap here
      if (sameChain && !sameToken) {
        console.log(
          "[Claim] 🔄 Same chain, different token - Using Uniswap swap (Testnet)"
        );

        const swapRouter02Address = getSwapRouter02Address(
          claim.currentChainId
        );
        const winnerTokenAddress = getTokenAddress(
          claim.currentChainId,
          claim.currentTokenSymbol
        );
        const requiredTokenAddress = getTokenAddress(
          claim.currentChainId,
          claim.preferredTokenSymbol
        );

        console.log("[Claim] Swap details:", {
          router: swapRouter02Address,
          tokenIn: winnerTokenAddress,
          tokenOut: requiredTokenAddress,
          amount: bidAmount.toString(),
        });

        const amountOutMinimum = (bidAmount * BigInt(995)) / BigInt(1000);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();

        const tokenContract = new ethers.Contract(
          winnerTokenAddress,
          ["function approve(address spender, uint256 amount) returns (bool)"],
          signer
        );

        console.log("[Claim] Approving tokens for swap...");
        const approveTx = await tokenContract.approve(
          swapRouter02Address,
          bidAmount.toString()
        );
        await approveTx.wait();
        console.log("[Claim] ✓ Token approval confirmed");

        const swapRouterContract = new ethers.Contract(
          swapRouter02Address,
          SWAP_ROUTER02_ABI,
          signer
        );

        const swapParams = {
          tokenIn: winnerTokenAddress,
          tokenOut: requiredTokenAddress,
          fee: 500, 
          recipient: auction.seller,
          amountIn: bidAmount.toString(),
          amountOutMinimum: amountOutMinimum.toString(),
          sqrtPriceLimitX96: 0, 
        };

        console.log("[Claim] Executing swap with params:", swapParams);
        const swapTx = await swapRouterContract.exactInputSingle(swapParams);
        console.log("[Claim] Swap transaction sent:", swapTx.hash);

        const receipt = await swapTx.wait();
        console.log("[Claim] ✓ Swap completed:", receipt);
        
        toast.success(
          `Successfully swapped ${humanReadableAmount} ${claim.currentTokenSymbol} to ${claim.preferredTokenSymbol} on ${claim.currentChainName}`
        );
        setTimeout(() => fetchMyAuctions(), 2000);
        return;
      }

      // CASE 3: Different chain (with same token) - Use bridge
      if (!sameChain && sameToken) {
        console.log(
          "[Claim] 🌉 Different chain, same token - Using Nexus bridge"
        );

        const result = await bridgeTokens(
          claim.currentTokenSymbol,
          humanReadableAmount,
          claim.preferredChainId,
          [claim.currentChainId]
        );

        console.log("[Claim] Bridge result:", result);

        if (result) {
          toast.success(
            `Successfully bridged ${humanReadableAmount} ${claim.currentTokenSymbol} from ${claim.currentChainName} to ${claim.preferredChainName}`
          );
          setTimeout(() => fetchMyAuctions(), 2000);
        } else {
          throw new Error("Bridge transaction failed");
        }
        return;
      }

      // CASE 4: Different chain AND different token - Use bridgeAndExecute
      if (!sameChain && !sameToken) {
        console.log(
          "[Claim] 🌉🔄 Different chain AND token - Using bridge + swap"
        );

        const swapRouter02Address = getSwapRouter02Address(
          claim.preferredChainId
        );
        const requiredTokenAddress = getTokenAddress(
          claim.preferredChainId,
          claim.preferredTokenSymbol
        );

        console.log("[Claim] Bridge + Swap details:", {
          fromChain: claim.currentChainId,
          toChain: claim.preferredChainId,
          token: claim.currentTokenSymbol,
          amount: humanReadableAmount,
          swapRouter: swapRouter02Address,
          tokenOut: requiredTokenAddress,
        });

        // For stablecoins, accept 0.5% slippage
        const amountOutMinimum = (bidAmount * BigInt(995)) / BigInt(1000);

        const bridgeAndExecuteResult: BridgeAndExecuteResult =
          await sdk.bridgeAndExecute({
            token: claim.currentTokenSymbol,
            amount: bidAmount.toString(),
            toChainId: claim.preferredChainId,
            sourceChains: [claim.currentChainId],
            execute: {
              contractAddress: swapRouter02Address,
              contractAbi: SWAP_ROUTER02_ABI,
              functionName: "exactInputSingle",
              buildFunctionParams: (
                token: any,
                amount: string,
                chainId: number,
                userAddress: `0x${string}`
              ) => {
                const tokenInOnDestination = getTokenAddress(
                  chainId,
                  claim.currentTokenSymbol
                );

                const swapParams = {
                  tokenIn: tokenInOnDestination, // Token address on destination chain after bridge
                  tokenOut: requiredTokenAddress, // Final desired token on destination chain
                  fee: 500, // 0.05% fee tier for stable coin pairs
                  recipient: auction.seller,
                  amountIn: amount,
                  amountOutMinimum: amountOutMinimum.toString(),
                  sqrtPriceLimitX96: 0, // No price limit for stable coins
                };

                return {
                  functionParams: [swapParams],
                };
              },
              tokenApproval: {
                token: claim.currentTokenSymbol,
                amount: bidAmount.toString(),
              },
            },
            waitForReceipt: true,
          } as BridgeAndExecuteParams);

        console.log("[Claim] BridgeAndExecute result:", bridgeAndExecuteResult);

        if (bridgeAndExecuteResult) {
          toast.success(
            `Successfully bridged and swapped ${humanReadableAmount} ${claim.currentTokenSymbol} to ${claim.preferredTokenSymbol} on ${claim.preferredChainName}`
          );
          setTimeout(() => fetchMyAuctions(), 2000);
        } else {
          throw new Error("Bridge and execute failed");
        }
        return;
      }
    } catch (error: any) {
      console.error("Claim error:", error);

      let errorMessage = "Unknown error";
      if (error?.message) {
        if (
          error.message.includes("user rejected") ||
          error.message.includes("User denied")
        ) {
          errorMessage = "Transaction was rejected";
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(`Failed to claim: ${errorMessage}`);
    } finally {
      setClaimingAuction(null);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      fetchMyAuctions();
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchMyAuctions, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected, address]);

  // Detect pending claims for settled auctions
  useEffect(() => {
    if (!address || myAuctions.length === 0) return;

    const claimsMap: { [intentId: string]: any } = {};
    
    for (const auction of myAuctions) {
      if (auction.status === 3) { // Only check settled auctions (status 3 = Settled, not yet claimed)
        const bids = auctionBids[auction.intentId] || [];
        const claim = detectPendingClaim(auction, bids, address);
        if (claim) {
          claimsMap[auction.intentId] = claim;
        }
      }
    }
    
    setPendingClaims(claimsMap);

    // Clean up localStorage: remove auctions that are now showing as Claimed (status 4) on-chain
    const currentClaimedSet = new Set(locallyClaimedAuctions);
    let hasChanges = false;
    
    for (const auction of myAuctions) {
      if (auction.status === 4 && currentClaimedSet.has(auction.intentId)) {
        currentClaimedSet.delete(auction.intentId);
        hasChanges = true;
        console.log(`[LocalStorage] Removed claimed auction ${auction.intentId} (now confirmed on-chain)`);
      }
    }
    
    if (hasChanges) {
      setLocallyClaimedAuctions(currentClaimedSet);
      localStorage.setItem('claimedAuctions', JSON.stringify(Array.from(currentClaimedSet)));
    }
  }, [myAuctions, auctionBids, address, locallyClaimedAuctions]);

  const formatTimeLeft = (deadline: string) => {
    const now = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    const secondsLeft = deadlineNum - now;

    if (secondsLeft <= 0) return "Ended";

    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    // For auctions under 1 hour, show minutes and seconds
    if (hours === 0) {
      return `${minutes}m ${seconds}s`;
    }

    // For longer auctions, show hours and minutes
    if (hours < 24) {
      return `${hours}h ${minutes}m`;
    }

    // For very long auctions, show days
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  };

  const formatPrice = (price: string) => {
    try {
      return ethers.formatUnits(price, 6);
    } catch {
      return "0";
    }
  };

  const getHighestBid = (auctionId: string) => {
    const bids = auctionBids[auctionId] || [];
    if (bids.length === 0) return null;

    // Aggregate bids by bidder address (same logic as LiveBid component)
    const bidderMap = new Map<
      string,
      {
        bidder: string;
        amount: bigint;
        timestamp: string;
        sourceChain: string;
      }
    >();

    bids.forEach((bid) => {
      const bidderKey = bid.bidder.toLowerCase();
      const existing = bidderMap.get(bidderKey);

      if (existing) {
        existing.amount += BigInt(bid.amount);
        if (parseInt(bid.timestamp) > parseInt(existing.timestamp)) {
          existing.timestamp = bid.timestamp;
          existing.sourceChain = bid.sourceChain;
        }
      } else {
        bidderMap.set(bidderKey, {
          bidder: bid.bidder,
          amount: BigInt(bid.amount),
          timestamp: bid.timestamp,
          sourceChain: bid.sourceChain,
        });
      }
    });

    // Convert to array and find highest
    const aggregatedBids = Array.from(bidderMap.values());
    if (aggregatedBids.length === 0) return null;

    const highest = aggregatedBids.reduce((max, current) => {
      return current.amount > max.amount ? current : max;
    });

    return {
      bidder: highest.bidder,
      amount: highest.amount.toString(),
      timestamp: highest.timestamp,
      sourceChain: highest.sourceChain,
      token: bids[0].token,
      intentId: bids[0].intentId,
      transactionHash: bids[0].transactionHash,
    };
  };

  const canCancel = (auction: Auction) => {
    const bids = auctionBids[auction.intentId] || [];
    const now = Math.floor(Date.now() / 1000);
    const deadline = parseInt(auction.deadline);

    return (
      auction.status === 0 && // Active (not cancelled, finalized, or settled)
      bids.length === 0 && // No bids
      deadline > now // Not ended
    );
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

      {/* Content */}
      <div className="relative z-10">
        <Navbar activeTab="my_auctions" onTabChange={() => {}} />
        <main className="max-w-7xl mx-auto pt-24 p-8">
          <div className="relative backdrop-blur-sm bg-white/5 rounded-2xl p-8 border border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  My Auctions
                </h1>
                <p className="text-white/70">
                  Manage your NFT auctions and track bidding activity
                </p>
              </div>
              <div className="flex gap-4">
                <Link
                  href="/auctions"
                  className="px-6 py-3 bg-white/10 border border-white/20 text-white font-semibold rounded-lg hover:bg-white/20 transition-colors"
                >
                  Browse Auctions
                </Link>
                <Link
                  href="/create"
                  className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-colors"
                >
                  Create New
                </Link>
              </div>
            </div>

            {/* Stats */}
            {myAuctions.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-white">
                    {myAuctions.length}
                  </div>
                  <div className="text-white/70 text-sm">Total Auctions</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-green-400">
                    {myAuctions.filter((a) => a.status === 0).length}
                  </div>
                  <div className="text-white/70 text-sm">Active</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-blue-400">
                    {Object.values(auctionBids).reduce(
                      (total, bids) => total + bids.length,
                      0
                    )}
                  </div>
                  <div className="text-white/70 text-sm">Total Bids</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-purple-400">
                    {myAuctions.filter((a) => a.status === 2).length}
                  </div>
                  <div className="text-white/70 text-sm">Settled</div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg backdrop-blur-sm">
                <p className="text-red-300 text-center">⚠️ {error}</p>
              </div>
            )}

            {/* Auctions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {loading ? (
                // Loading skeletons
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm animate-pulse"
                  >
                    <div className="w-full h-48 bg-white/10 rounded-lg mb-4"></div>
                    <div className="h-4 bg-white/10 rounded mb-2"></div>
                    <div className="h-3 bg-white/10 rounded mb-4 w-2/3"></div>
                    <div className="h-3 bg-white/10 rounded w-1/2"></div>
                  </div>
                ))
              ) : myAuctions.length > 0 ? (
                myAuctions.map((auction) => {
                  const bids = auctionBids[auction.intentId] || [];
                  const highestBid = getHighestBid(auction.intentId);
                  const isEnded =
                    parseInt(auction.deadline) <= Math.floor(Date.now() / 1000);

                  return (
                    <div
                      key={auction.intentId}
                      className="bg-white/5 p-6 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-200"
                    >
                      <div className="w-full h-48 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg mb-4 flex items-center justify-center overflow-hidden relative">
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                          <span className="text-white/30 text-xs mb-2">
                            NFT Contract
                          </span>
                          <span className="text-white/50 text-xs font-mono break-all text-center">
                            {auction.nftContract.slice(0, 6)}...
                            {auction.nftContract.slice(-4)}
                          </span>
                          <span className="text-white/70 text-2xl font-bold mt-2">
                            #{auction.tokenId}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div
                          className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                            auction.status === 0
                              ? isEnded
                                ? "bg-orange-500/20 text-orange-300"
                                : "bg-green-500/20 text-green-300"
                              : auction.status === 1
                              ? "bg-blue-500/20 text-blue-300"
                              : auction.status === 2
                              ? "bg-purple-500/20 text-purple-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {auction.status === 0 && isEnded
                            ? "Ended"
                            : STATUS_NAMES[
                                auction.status as keyof typeof STATUS_NAMES
                              ]}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-white font-semibold truncate">
                          Token #{auction.tokenId}
                        </h3>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/50">Starting:</span>
                          <span className="text-white/90 font-mono">
                            ${formatPrice(auction.startingPrice)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/50">Reserve:</span>
                          <span className="text-white/90 font-mono">
                            ${formatPrice(auction.reservePrice)}
                          </span>
                        </div>

                        {highestBid && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/50">Highest Bid:</span>
                            <span className="text-green-400 font-mono font-semibold">
                              ${formatPrice(highestBid.amount)}
                            </span>
                          </div>
                        )}

                        <div className="pt-3 border-t border-white/10">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-white/50 text-sm flex items-center">
                              <span className="mr-1">⏰</span>
                              {formatTimeLeft(auction.deadline)}
                            </span>
                            <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">
                              {CHAIN_NAMES[auction.sourceChain] ||
                                auction.sourceChain}
                            </span>
                          </div>

                          <div className="text-sm text-white/50">
                            {(() => {
                              // Count unique bidders
                              const bids = auctionBids[auction.intentId] || [];
                              const uniqueBidders = new Set(
                                bids.map((b) => b.bidder.toLowerCase())
                              );
                              return `${uniqueBidders.size} bidder${
                                uniqueBidders.size !== 1 ? "s" : ""
                              }`;
                            })()}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-3">
                          {/* Claim Button for Settled Auctions */}
                          {auction.status === 3 &&
                            address &&
                            !locallyClaimedAuctions.has(auction.intentId) &&
                            (() => {
                              const claim = pendingClaims[auction.intentId];

                              if (!claim) return null;

                              const sameChain =
                                claim.currentChainId === claim.preferredChainId;
                              const sameToken =
                                claim.currentTokenSymbol ===
                                claim.preferredTokenSymbol;

                              // Check if user is on the correct chain
                              const requiredChainId = CHAIN_NAME_TO_ID[auction.sourceChain];
                              const isOnCorrectChain = currentChainId === requiredChainId;
                              const requiredChainName = CHAIN_NAMES[auction.sourceChain] || auction.sourceChain;

                              // Case 1: Same chain AND same token - Hide button, show message instead
                              if (sameChain && sameToken) {
                                return (
                                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                                    <p className="text-xs text-green-300 text-center">
                                      Funds already on{" "}
                                      {claim.preferredChainName} with{" "}
                                      {claim.preferredTokenSymbol}
                                    </p>
                                  </div>
                                );
                              }

                              // Determine button text based on case
                              let buttonText = "";

                              if (sameChain && !sameToken) {
                                // Case 2: Same chain, different token - Swap needed
                                buttonText = `Swap ${claim.currentTokenSymbol} to ${claim.preferredTokenSymbol}`;
                              } else if (!sameChain && sameToken) {
                                // Case 3: Different chain, same token - Bridge only
                                buttonText = `Bridge to ${claim.preferredChainName}`;
                              } else {
                                // Case 4: Different chain AND token - Bridge + Swap
                                buttonText = `Bridge & Swap to ${claim.preferredTokenSymbol}`;
                              }

                              return (
                                <div className="space-y-2">
                                  {/* Chain warning message */}
                                  {!isOnCorrectChain && (
                                    <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-2">
                                      <p className="text-xs text-yellow-300 text-center">
                                        ⚠️ Switch to {requiredChainName} to claim
                                      </p>
                                    </div>
                                  )}
                                  
                                  <button
                                    onClick={() => handleClaim(auction)}
                                    disabled={
                                      claimingAuction === auction.intentId ||
                                      !initialized ||
                                      !isOnCorrectChain
                                    }
                                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                  >
                                    {claimingAuction === auction.intentId ? (
                                      <span className="flex items-center justify-center gap-2">
                                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                                        Processing...
                                      </span>
                                    ) : (
                                      <span className="flex items-center justify-center gap-2">
                                        <span>{buttonText}</span>
                                      </span>
                                    )}
                                  </button>
                                  {!initialized && (
                                    <p className="text-xs text-yellow-400 text-center">
                                      Initialize Nexus to enable cross-chain
                                      operations
                                    </p>
                                  )}
                                </div>
                              );
                            })()}

                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedAuction(auction)}
                              className="flex-1 py-2 bg-white/10 border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
                            >
                              View Details
                            </button>

                            {canCancel(auction) && (
                              <button
                                onClick={() => cancelAuction(auction)}
                                disabled={cancelling === auction.intentId}
                                className="px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                {cancelling === auction.intentId
                                  ? "..."
                                  : "Cancel"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full bg-white/5 p-16 rounded-xl border border-white/10 backdrop-blur-sm text-center">
                  {/* Icon */}
                  <div className="mb-6 flex justify-center">
                    <div className="w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-white/50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </div>
                  </div>

                  <h3 className="text-white text-2xl font-semibold mb-3">
                    No Auctions Created
                  </h3>
                  <p className="text-white/60 mb-8 max-w-md mx-auto">
                    You haven't created any auctions yet. Start trading your
                    NFTs across multiple blockchains.
                  </p>
                  <Link
                    href="/create"
                    className="inline-flex px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Create Your First Auction
                  </Link>
                </div>
              )}
            </div>

            {/* Refresh Button */}
            {isConnected && (
              <div className="text-center">
                <button
                  onClick={fetchMyAuctions}
                  disabled={loading}
                  className="px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-black rounded-xl border border-white/20 hover:bg-white/10 disabled:opacity-50"
                >
                  {loading ? "Loading..." : "Refresh My Auctions"}
                </button>
              </div>
            )}

            {/* Connection Status */}
            {!isConnected && (
              <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg backdrop-blur-sm">
                <p className="text-yellow-300 text-center">
                  Connect your wallet to view your auctions
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Auction Details Modal */}
      {selectedAuction && (
        <AuctionDetailsModal
          auction={selectedAuction}
          bids={auctionBids[selectedAuction.intentId] || []}
          onClose={() => setSelectedAuction(null)}
          onCancel={
            canCancel(selectedAuction)
              ? () => cancelAuction(selectedAuction)
              : undefined
          }
          cancelling={cancelling === selectedAuction.intentId}
        />
      )}
    </div>
  );
}

// Auction Details Modal Component
interface AuctionDetailsModalProps {
  auction: Auction;
  bids: Bid[];
  onClose: () => void;
  onCancel?: () => void;
  cancelling: boolean;
}

function AuctionDetailsModal({
  auction,
  bids,
  onClose,
  onCancel,
  cancelling,
}: AuctionDetailsModalProps) {
  const formatPrice = (price: string) => {
    try {
      return ethers.formatUnits(price, 6);
    } catch {
      return "0";
    }
  };

  const formatTimeLeft = (deadline: string) => {
    const now = Math.floor(Date.now() / 1000);
    const deadlineNum = parseInt(deadline);
    const secondsLeft = deadlineNum - now;

    if (secondsLeft <= 0) return "Auction Ended";

    const days = Math.floor(secondsLeft / 86400);
    const hours = Math.floor((secondsLeft % 86400) / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  const isEnded = parseInt(auction.deadline) <= Math.floor(Date.now() / 1000);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 border border-white/20 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Auction Details</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Auction Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="text-white/70 text-sm">NFT Contract</label>
              <p className="text-white font-mono text-sm break-all">
                {auction.nftContract}
              </p>
            </div>
            <div>
              <label className="text-white/70 text-sm">Token ID</label>
              <p className="text-white font-bold text-xl">#{auction.tokenId}</p>
            </div>
            <div>
              <label className="text-white/70 text-sm">Chain</label>
              <p className="text-white">
                {CHAIN_NAMES[auction.sourceChain] || auction.sourceChain}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-white/70 text-sm">Starting Price</label>
              <p className="text-white font-bold text-xl">
                ${formatPrice(auction.startingPrice)}
              </p>
            </div>
            <div>
              <label className="text-white/70 text-sm">Reserve Price</label>
              <p className="text-white font-bold text-xl">
                ${formatPrice(auction.reservePrice)}
              </p>
            </div>
            <div>
              <label className="text-white/70 text-sm">Time Left</label>
              <p
                className={`font-bold text-xl ${
                  isEnded ? "text-red-400" : "text-green-400"
                }`}
              >
                {formatTimeLeft(auction.deadline)}
              </p>
            </div>
          </div>
        </div>

        {/* Live Bidding Section */}
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-4">
            Live Bidding ({bids.length} bid{bids.length !== 1 ? "s" : ""})
          </h3>

          {bids.length > 0 ? (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(() => {
                // Aggregate bids by bidder
                const bidderMap = new Map<
                  string,
                  {
                    bidder: string;
                    amount: bigint;
                    timestamp: string;
                    chains: Set<string>;
                    bidCount: number;
                  }
                >();

                bids.forEach((bid) => {
                  const bidderKey = bid.bidder.toLowerCase();
                  const existing = bidderMap.get(bidderKey);

                  if (existing) {
                    existing.amount += BigInt(bid.amount);
                    if (bid.sourceChain) {
                      existing.chains.add(bid.sourceChain);
                    }
                    existing.bidCount += 1;
                    if (
                      parseInt(bid.timestamp) > parseInt(existing.timestamp)
                    ) {
                      existing.timestamp = bid.timestamp;
                    }
                  } else {
                    const chains = new Set<string>();
                    if (bid.sourceChain) {
                      chains.add(bid.sourceChain);
                    }
                    bidderMap.set(bidderKey, {
                      bidder: bid.bidder,
                      amount: BigInt(bid.amount),
                      timestamp: bid.timestamp,
                      chains: chains,
                      bidCount: 1,
                    });
                  }
                });

                // Convert to array and sort
                const aggregatedBids = Array.from(bidderMap.values()).sort(
                  (a, b) => {
                    return b.amount > a.amount ? 1 : -1;
                  }
                );

                return aggregatedBids.map((bid, index) => (
                  <div
                    key={bid.bidder}
                    className="bg-white/5 p-4 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <span className="text-green-400 text-sm">
                              👑 Highest Bid
                            </span>
                          )}
                          <span className="text-white/70 text-sm">
                            {bid.bidder.slice(0, 6)}...{bid.bidder.slice(-4)}
                          </span>
                        </div>
                        <div className="text-white/50 text-xs">
                          {new Date(bid.timestamp).toLocaleString()}
                        </div>
                        <div className="text-white/50 text-xs">
                          Chain:{" "}
                          {Array.from(bid.chains)
                            .map((c) => CHAIN_NAMES[c] || c)
                            .join(", ")}
                        </div>
                        {bid.bidCount > 1 && (
                          <div className="text-white/50 text-xs">
                            {bid.bidCount} transactions
                          </div>
                        )}
                      </div>
                      <div
                        className={`text-right ${
                          index === 0 ? "text-green-400" : "text-white"
                        } font-bold text-lg`}
                      >
                        ${ethers.formatUnits(bid.amount.toString(), 6)}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div className="bg-white/5 p-8 rounded-lg border border-white/10 text-center">
              <p className="text-white/70">No bids yet</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
          >
            Close
          </button>

          {onCancel && (
            <button
              onClick={onCancel}
              disabled={cancelling}
              className="px-6 py-3 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg font-medium hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {cancelling ? "Cancelling..." : "Cancel Auction"}
            </button>
          )}

          <a
            href={`https://sepolia.etherscan.io/tx/${auction.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg font-medium hover:bg-blue-500/30 transition-colors"
          >
            View on Explorer
          </a>
        </div>
      </div>
    </div>
  );
}
