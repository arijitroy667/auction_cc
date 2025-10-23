import { ethers } from "ethers";
import { CONFIG } from "./config";
import { getAllAuctions, getBids, updateAuctionStatus } from "./event-listner";
import AUCTION_HUB_ABI from "../src/ABI/AUCTION_HUB_ABI.json";
import BID_MANAGER_ABI from "../src/ABI/BID_MANAGER_ABI.json";

// AuctionStatus enum values (must match AuctionTypes.sol)
const AuctionStatus = {
    Created: 0,
    Active: 1,
    Finalized: 2,
    Settled: 3,
    Cancelled: 4
} as const;

// Processing lock to prevent concurrent processing of the same auction
const processingLocks = new Set<string>();

function getChainConfig(chainIdentifier: string | number) {
    const chains = Object.values(CONFIG.chains);
    let config;
    
    if (typeof chainIdentifier === "number" || /^\d+$/.test(String(chainIdentifier))) {
        const id = Number(chainIdentifier);
        config = chains.find(c => Number(c.id) === id);
        if (!config) {
            console.error(`[ERROR] Chain not found by id: "${chainIdentifier}"`);
            console.error(`[ERROR] Available chain ids:`, chains.map(c => c.id));
        } 
    } else {
        config = chains.find(c => c.name === chainIdentifier);
        if (!config) {
            console.error(`[ERROR] Chain not found by name: "${chainIdentifier}"`);
            console.error(`[ERROR] Available chain names:`, chains.map(c => c.name));
        } 
    }
    
    return config;
}

const TOKEN_ADDRESS_TO_SYMBOL: { [chainId: number]: { [address: string]: string } } = {
    11155111: { // Ethereum Sepolia
        '0xf08A50178dfcDe18524640EA6618a1f965821715': 'USDC',
        '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0': 'USDT',
    },
    421614: { // Arbitrum Sepolia
        '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d': 'USDC',
        '0xb9a4873d8d2C22e56b8574e8605644d08E047434': 'USDT',
    },
    84532: { // Base Sepolia
        '0x036CbD53842c5426634e7929541eC2318f3dCF7e': 'USDC',
        '0xf7e53b20f39a5f8c35005fEf37eef03A7b0d0B5a': 'USDT',
    },
    11155420: { // Optimism Sepolia
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': 'USDC',
        '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': 'USDT',
    },
};

// Stable coin decimals mapping
const STABLE_COIN_DECIMALS: { [symbol: string]: number } = {
    'USDC': 6,
    'USDT': 6,
    'USDC.e': 6,
};

// Stable coins that can be considered equivalent (1:1 ratio)
const EQUIVALENT_STABLE_COINS = ['USDC', 'USDT', 'USDC.e'];

function getTokenSymbol(tokenAddress: string, chainId: number): string {
    const chainTokens = TOKEN_ADDRESS_TO_SYMBOL[chainId];
    if (!chainTokens) {
        throw new Error(`Token mapping not found for chain ${chainId}`);
    }
    
    const normalizedAddress = tokenAddress.toLowerCase();
    let symbol = chainTokens[normalizedAddress];
    
    if (!symbol) {
        for (const [addr, sym] of Object.entries(chainTokens)) {
            if (addr.toLowerCase() === normalizedAddress) {
                symbol = sym;
                break;
            }
        }
    }
    
    if (!symbol) {
        console.error(`[ERROR] Token lookup failed:`);
        console.error(`- Looking for: ${tokenAddress}`);
        console.error(`- Chain: ${chainId}`);
        console.error(`- Available tokens:`, Object.keys(chainTokens));
        throw new Error(`Token symbol not found for address ${tokenAddress} on chain ${chainId}`);
    }
    
    return symbol;
}

function getTokenDecimals(tokenSymbol: string): number {
    return STABLE_COIN_DECIMALS[tokenSymbol] || 18;
}

function formatStableCoinAmount(amount: string | bigint, tokenSymbol: string): string {
    const decimals = getTokenDecimals(tokenSymbol);
    return ethers.formatUnits(amount, decimals);
}

function isStableCoin(tokenSymbol: string): boolean {
    return EQUIVALENT_STABLE_COINS.includes(tokenSymbol);
}

function areEquivalentStableCoins(token1: string, token2: string): boolean {
    return isStableCoin(token1) && isStableCoin(token2);
}

function validateStableCoinOnlyAuction(winnerToken: string, requiredToken: string, sourceChainId: number, targetChainId: number): void {
    const winnerSymbol = getTokenSymbol(winnerToken, sourceChainId);
    const requiredSymbol = getTokenSymbol(requiredToken, targetChainId);
    
    if (!isStableCoin(winnerSymbol)) {
        console.warn(`⚠️  WARNING: Winner token ${winnerSymbol} is not a recognized stable coin!`);
    }
    
    if (!isStableCoin(requiredSymbol)) {
        console.warn(`⚠️  WARNING: Required token ${requiredSymbol} is not a recognized stable coin!`);
    }
    
    if (!isStableCoin(winnerSymbol) || !isStableCoin(requiredSymbol)) {
        console.warn(`⚠️  This auction system is optimized for stable coin transactions only.`);
        console.warn(`⚠️  Non-stable coin swaps may result in high slippage and unexpected behavior.`);
    }
}

export async function processEndedAuctions() {
    console.log(`\n[*] 📊 Processing ended auctions... (${new Date().toLocaleTimeString()}) - 10s interval`);

    // ✅ Use database instead of in-memory storage
    const allAuctions = await getAllAuctions();
    const currentTime = Math.floor(Date.now() / 1000);

    if (allAuctions.size === 0) {
        console.log("   - No auctions found in database");
        return;
    }

    console.log(`   - Found ${allAuctions.size} auctions to check`);

    for (const [intentId, auctionData] of allAuctions.entries()) {
        try {
            if (processingLocks.has(intentId)) {
                continue;
            }

            const auctionChain = getChainConfig(auctionData.sourceChain);
            if (!auctionChain) {
                console.error(`[-] Unknown chain: ${auctionData.sourceChain} for auction ${intentId.slice(0, 10)}...`);
                console.error(`[-] Available chains:`, Object.keys(CONFIG.chains));
                continue;
            }

            const provider = new ethers.JsonRpcProvider(auctionChain.rpcUrl);
            const auctionHub = new ethers.Contract(
                auctionChain.auctionHubAddress,
                AUCTION_HUB_ABI,
                provider
            ) as any;
            const keeperWallet = new ethers.Wallet(CONFIG.keeperPrivateKey, provider);

            // Get auction from blockchain to verify current status
            const auction = await auctionHub.auctions(intentId);
            
            // Check if auction exists on blockchain
            if (auction.seller === ethers.ZeroAddress) {
                console.log(`   - Auction ${intentId.slice(0, 10)}... not found on blockchain, skipping`);
                continue;
            }

            const auctionDeadline = Number(auction.deadline);
            const timeLeft = auctionDeadline - currentTime;
            
            if (timeLeft <= 0) {
                console.log(`   - 🔥 Auction ${intentId.slice(0, 10)}... has ended! Processing now...`);
            }

            const auctionStatus = Number(auction.status);

            // Skip if auction hasn't ended
            if (auctionDeadline > currentTime) {
                continue;
            }

            // Skip if already settled or cancelled
            if (auctionStatus === AuctionStatus.Settled || auctionStatus === AuctionStatus.Cancelled) {
                console.log(`   - Auction ${intentId.slice(0, 10)}... already completed (status: ${auctionStatus}), skipping...`);
                
                // ✅ Update database status if it doesn't match
                if (auctionData.status !== auctionStatus) {
                    await updateAuctionStatus(intentId, auctionStatus);
                }
                continue;
            }

            console.log(`[!] Auction ${intentId.slice(0, 10)}... on ${auctionData.sourceChain} has ended. Processing...`);

            // Acquire processing lock to prevent concurrent processing
            processingLocks.add(intentId);
            console.log(`   - 🔒 Processing lock acquired for auction ${intentId.slice(0, 10)}...`);

            // ✅ Use database to get bids
            const bids = await getBids(intentId);
            console.log(`   - Found ${bids.length} bids for this auction`);

            if (bids.length === 0) {
                console.log("   - No bids found. Auction needs to be cancelled by seller (keeper cannot cancel).");
                processingLocks.delete(intentId);
                continue;
            }

            let winner = null;
            let highestBid = BigInt(0);

            // Aggregate bids by bidder address
            const bidderMap = new Map<string, { bidder: string; totalAmount: bigint; token: string; sourceChain: string }>();
            
            for (const bid of bids) {
                const bidderKey = bid.bidder.toLowerCase();
                const bidAmount = BigInt(bid.amount);
                
                if (bidderMap.has(bidderKey)) {
                    const existing = bidderMap.get(bidderKey)!;
                    existing.totalAmount += bidAmount;
                } else {
                    bidderMap.set(bidderKey, {
                        bidder: bid.bidder,
                        totalAmount: bidAmount,
                        token: bid.token,
                        sourceChain: bid.sourceChain
                    });
                }
            }

            // Find the bidder with the highest total bid
            for (const [_, aggregatedBid] of bidderMap.entries()) {
                if (aggregatedBid.totalAmount > highestBid) {
                    highestBid = aggregatedBid.totalAmount;
                    winner = {
                        bidder: aggregatedBid.bidder,
                        amount: aggregatedBid.totalAmount.toString(),
                        token: aggregatedBid.token,
                        sourceChain: aggregatedBid.sourceChain
                    };
                }
            }

            const reservePrice = BigInt(auction.reservePrice);

            if (!winner || highestBid < reservePrice) {
                console.log(`   - No valid bids met the reserve price (${ethers.formatUnits(reservePrice, 6)}). Auction needs to be cancelled by seller.`);
                processingLocks.delete(intentId);
                continue;
            }

            // Only finalize if status is Active
            if (auctionStatus === AuctionStatus.Active) {
                console.log("   - Step 1: Finalizing auction (marking winner)...");
                try {
                    const finalizeTx = await auctionHub.connect(keeperWallet).finalizeAuction(intentId, winner.bidder, winner.amount);
                    await finalizeTx.wait();
                    console.log(`   - ✓ Auction finalized (status: Active → Finalized). Tx: ${finalizeTx.hash}`);
                    
                    // ✅ Update database status
                    await updateAuctionStatus(intentId, AuctionStatus.Finalized);
                } catch (error: any) {
                    console.error("   - ✗ Failed to finalize auction:", error?.message || error);
                    if (error?.message?.includes("Auction not ended")) {
                        console.error("   - ⚠️  Blockchain time may not have reached deadline yet. Will retry next cycle.");
                        processingLocks.delete(intentId);
                        continue;
                    }
                }
            } else if (auctionStatus === AuctionStatus.Finalized) {
                console.log("   - Step 1: Auction already finalized, proceeding to settlement...");
            }

            // Step 2: Cross-chain settlement
            console.log("   - Step 2: Starting cross-chain settlement...");
            try {
                await settleCrossChainAuction(intentId, auction, winner, bids, auctionData.sourceChain);
                console.log(`   - ✓ Cross-chain settlement completed for auction ${intentId.slice(0, 10)}...`);
                
                // ✅ Update database status to settled
                await updateAuctionStatus(intentId, AuctionStatus.Settled);
            } catch (error: any) {
                console.error(`   - ✗ Settlement failed for auction ${intentId.slice(0, 10)}...:`, error?.message || error);
                processingLocks.delete(intentId);
                continue;
            }

            // Release processing lock after successful completion
            processingLocks.delete(intentId);
            console.log(`   - 🔓 Processing lock released for auction ${intentId.slice(0, 10)}...`);

        } catch (error) {
            console.error(`   - Error processing auction ${intentId.slice(0, 10)}...:`, error);
            processingLocks.delete(intentId);
        }
    }

    console.log(`[*] Finished processing auctions (${new Date().toLocaleTimeString()})\n`);
}

async function settleCrossChainAuction(intentId: string, auction: any, winner: any, allBids: any[], sourceChain: string) {
    try {
        console.log(`   - Starting cross-chain settlement for auction ${intentId.slice(0, 10)}...`);
        
        const sourceChainConfig = getChainConfig(sourceChain);

        // Handle preferred chain properly - it might be stored as different property names
        let targetChainConfig;
        if (auction.preferdChain !== undefined && auction.preferdChain !== null && auction.preferdChain !== "") {
            // try numeric id first
            const numericId = Number(auction.preferdChain);
            if (!isNaN(numericId) && numericId !== 0) {
                targetChainConfig = Object.values(CONFIG.chains).find(c => Number(c.id) === numericId);
            }
            // fallback: try using getChainConfig (handles name or id)
            if (!targetChainConfig) {
                targetChainConfig = getChainConfig(auction.preferdChain as any);
            }
        }
        
        const targetConfig = targetChainConfig;
        const targetChain = targetConfig;
        
        if (!sourceChainConfig || !targetChain) {
            console.error(`Chain configuration not found:`);
            console.error(`- Source chain: ${sourceChain} -> ${sourceChainConfig ? 'Found' : 'NOT FOUND'}`);
            console.error(`- Target chain: ${auction.preferdChain} -> ${targetChain ? 'Found' : 'NOT FOUND'}`);
            console.error(`- Available chains:`, Object.keys(CONFIG.chains));
            throw new Error(`Chain configuration not found`);
        }

        console.log(`   - Source chain: ${sourceChain} (${sourceChainConfig.name})`);
        console.log(`   - Target chain: ${targetChain.name} (${targetConfig.id})`);

        // Get BidManager contract on winner's chain to release the winning bid
        const winnerChainConfig = getChainConfig(winner.sourceChain);
        if (!winnerChainConfig) {
            throw new Error(`Winner's chain configuration not found: ${winner.sourceChain}`);
        }

        const sourceProvider = new ethers.JsonRpcProvider(winnerChainConfig.rpcUrl);
        const bidManager = new ethers.Contract(
            winnerChainConfig.bidManagerAddress,
            BID_MANAGER_ABI,
            new ethers.Wallet(CONFIG.keeperPrivateKey, sourceProvider)
        ) as any;

        // Release the winning bid from BidManager
        console.log(`   - Releasing winning bid from BidManager on ${winner.sourceChain}...`);
        const releaseTx = await bidManager.releaseWinningBid(intentId, winner.bidder, auction.seller);
        await releaseTx.wait();
        console.log(`   - ✅ Winning bid released to seller on ${winnerChainConfig.name}. Tx: ${releaseTx.hash}`);

        const winnerTokenAddress = winner.token;
        const requiredTokenAddress = auction.preferdToken;
        const bidAmount = winner.amount;

        // Validate that we're working with stable coins as expected
        validateStableCoinOnlyAuction(winnerTokenAddress, requiredTokenAddress, winnerChainConfig.id, targetConfig.id);

        // Convert token addresses to symbols
        const winnerTokenSymbol = getTokenSymbol(winnerTokenAddress, winnerChainConfig.id);
        const requiredTokenSymbol = getTokenSymbol(requiredTokenAddress, targetConfig.id);

        console.log(`   - Winner token: ${winnerTokenSymbol} (${formatStableCoinAmount(bidAmount, winnerTokenSymbol)})`);
        console.log(`   - Required token: ${requiredTokenSymbol}`);
        console.log(`   - Current location: ${winnerChainConfig.name} (${winnerChainConfig.id})`);
        console.log(`   - Preferred destination: ${targetConfig.name} (${targetConfig.id})`);

        // ✅ UPDATED: No automatic cross-chain transfer - seller must claim manually
        if (winnerChainConfig.id === targetConfig.id && winnerTokenSymbol === requiredTokenSymbol) {
            console.log(`   - 🎉 Perfect match! Funds already on seller's preferred chain with correct token!`);
            console.log(`   - ✅ No additional action needed - settlement complete`);
            console.log(`   - 💰 Seller has: ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol} on ${winnerChainConfig.name}`);
        } else {
            // All other cases require manual intervention via frontend
            console.log(`   - 🔄 Cross-chain/token transfer needed - manual claim required`);
            console.log(`   - 💰 Available: ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol} on ${winnerChainConfig.name}`);
            console.log(`   - 🎯 Target: ${requiredTokenSymbol} on ${targetConfig.name}`);
            
            if (winnerChainConfig.id !== targetConfig.id && winnerTokenSymbol === requiredTokenSymbol) {
                console.log(`   - 🌉 Same token, different chain - bridge needed`);
                console.log(`   - 📍 Bridge: ${winnerChainConfig.name} → ${targetConfig.name}`);
            } else if (winnerChainConfig.id === targetConfig.id && winnerTokenSymbol !== requiredTokenSymbol) {
                console.log(`   - 🔄 Same chain, different token - swap needed`);
                console.log(`   - 🔀 Swap: ${winnerTokenSymbol} → ${requiredTokenSymbol} on ${winnerChainConfig.name}`);
            } else {
                console.log(`   - 🌉🔄 Both bridge and swap needed`);
                console.log(`   - 📍 Bridge: ${winnerChainConfig.name} → ${targetConfig.name}`);
                console.log(`   - 🔀 Swap: ${winnerTokenSymbol} → ${requiredTokenSymbol}`);
            }
            
            console.log(`   - 💡 Seller must use frontend "Claim Auction Proceeds" button to:`);
            console.log(`   - 📱 Bridge funds using Avail Nexus SDK`);
            if (winnerTokenSymbol !== requiredTokenSymbol && areEquivalentStableCoins(winnerTokenSymbol, requiredTokenSymbol)) {
                console.log(`   - 🔀 Swap ${winnerTokenSymbol} to ${requiredTokenSymbol} (stable coin swap)`);
            }
            console.log(`   - ✅ This demonstrates proper user-initiated Nexus SDK usage`);
        }
        
        console.log(`   - 📝 Backend only releases funds - frontend handles cross-chain operations`);
        console.log(`   - ✅ Fund release phase completed successfully`);

        // Refund losing bidders
        console.log(`   - Refunding losing bidders...`);
        for (const bid of allBids) {
            if (bid.bidder.toLowerCase() !== winner.bidder.toLowerCase()) {
                try {
                    const bidChainConfig = getChainConfig(bid.sourceChain);
                    if (!bidChainConfig) {
                        console.warn(`   - ⚠️  Chain config not found for bid on ${bid.sourceChain}, skipping refund`);
                        continue;
                    }

                    const bidProvider = new ethers.JsonRpcProvider(bidChainConfig.rpcUrl);
                    const bidManagerContract = new ethers.Contract(
                        bidChainConfig.bidManagerAddress,
                        BID_MANAGER_ABI,
                        new ethers.Wallet(CONFIG.keeperPrivateKey, bidProvider)
                    ) as any;

                    const refundTx = await bidManagerContract.refundBid(intentId, bid.bidder);
                    await refundTx.wait();
                    
                    const bidTokenSymbol = getTokenSymbol(bid.token, bidChainConfig.id);
                    const bidAmount = formatStableCoinAmount(bid.amount, bidTokenSymbol);
                    console.log(`   - ✅ Refunded ${bid.bidder.slice(0, 8)}... → ${bidAmount} ${bidTokenSymbol} on ${bid.sourceChain}. Tx: ${refundTx.hash}`);
                } catch (error) {
                    console.error(`   - ❌ Failed to refund bidder ${bid.bidder.slice(0, 8)}... on ${bid.sourceChain}:`, error);
                    // Continue with other refunds even if one fails
                }
            }
        }

        // Finally, release the NFT to the winner
        console.log(`   - Releasing NFT to winner...`);
        const auctionChainConfig = getChainConfig(sourceChain);
        if (!auctionChainConfig) {
            throw new Error(`Auction chain configuration not found for sourceChain: ${sourceChain}`);
        }
        
        const auctionProvider = new ethers.JsonRpcProvider(auctionChainConfig.rpcUrl);
        const auctionHub = new ethers.Contract(
            auctionChainConfig.auctionHubAddress,
            AUCTION_HUB_ABI,
            new ethers.Wallet(CONFIG.keeperPrivateKey, auctionProvider)
        ) as any;

        const nftReleaseTx = await auctionHub.NFTrelease(intentId);
        await nftReleaseTx.wait();
        console.log(`   - ✅ NFT released to winner ${winner.bidder.slice(0, 8)}... Tx: ${nftReleaseTx.hash}`);
        console.log(`   - 🎨 NFT Contract: ${auction.nftContract} Token ID: ${auction.tokenId}`);

        console.log(`   - ✅ Cross-chain settlement completed successfully for auction ${intentId.slice(0, 10)}...`);
        console.log(`   - 🏆 Winner: ${winner.bidder.slice(0, 8)}... gets the NFT`);
        console.log(`   - 💰 Seller: ${auction.seller.slice(0, 8)}... gets ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol}`);
        console.log(`   - 📱 Seller uses frontend to claim cross-chain funds if needed`);

    } catch (error) {
        console.error(`   - ❌ Error in cross-chain settlement for auction ${intentId.slice(0, 10)}...:`, error);
        throw error;
    }
}