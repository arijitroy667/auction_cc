"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEndedAuctions = processEndedAuctions;
const ethers_1 = require("ethers");
const config_1 = require("./config");
const event_listner_1 = require("./event-listner");
const AUCTION_HUB_ABI_json_1 = __importDefault(require("../src/ABI/AUCTION_HUB_ABI.json"));
const BID_MANAGER_ABI_json_1 = __importDefault(require("../src/ABI/BID_MANAGER_ABI.json"));
// AuctionStatus enum values (must match AuctionTypes.sol)
const AuctionStatus = {
    Created: 0,
    Active: 1,
    Finalized: 2,
    Settled: 3,
    Cancelled: 4
};
// Processing lock to prevent concurrent processing of the same auction
const processingLocks = new Set();
function getChainConfig(chainIdentifier) {
    const chains = Object.values(config_1.CONFIG.chains);
    let config;
    if (typeof chainIdentifier === "number" || /^\d+$/.test(String(chainIdentifier))) {
        const id = Number(chainIdentifier);
        config = chains.find(c => Number(c.id) === id);
        if (!config) {
            console.error(`[ERROR] Chain not found by id: "${chainIdentifier}"`);
            console.error(`[ERROR] Available chain ids:`, chains.map(c => c.id));
        }
    }
    else {
        config = chains.find(c => c.name === chainIdentifier);
        if (!config) {
            console.error(`[ERROR] Chain not found by name: "${chainIdentifier}"`);
            console.error(`[ERROR] Available chain names:`, chains.map(c => c.name));
        }
    }
    return config;
}
const TOKEN_ADDRESS_TO_SYMBOL = {
    11155111: {
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': 'USDC',
        '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06': 'USDT',
    },
    421614: {
        '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d': 'USDC',
        '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E': 'USDT',
    },
    84532: {
        '0x036CbD53842c5426634e7929541eC2318f3dCF7e': 'USDC',
        '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9': 'USDT',
    },
    11155420: {
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': 'USDC',
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT',
    },
};
// Stable coin decimals mapping
const STABLE_COIN_DECIMALS = {
    'USDC': 6,
    'USDT': 6,
    'USDC.e': 6, // Bridged USDC on some chains
};
// Stable coins that can be considered equivalent (1:1 ratio)
const EQUIVALENT_STABLE_COINS = ['USDC', 'USDT', 'USDC.e'];
function getTokenSymbol(tokenAddress, chainId) {
    const chainTokens = TOKEN_ADDRESS_TO_SYMBOL[chainId];
    if (!chainTokens) {
        throw new Error(`Token mapping not found for chain ${chainId}`);
    }
    // Make lookup case-insensitive by normalizing both the key and lookup address
    const normalizedAddress = tokenAddress.toLowerCase();
    // First try direct lookup
    let symbol = chainTokens[normalizedAddress];
    // If not found, search through all keys case-insensitively
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
function getTokenDecimals(tokenSymbol) {
    return STABLE_COIN_DECIMALS[tokenSymbol] || 18;
}
function formatStableCoinAmount(amount, tokenSymbol) {
    const decimals = getTokenDecimals(tokenSymbol);
    return ethers_1.ethers.formatUnits(amount, decimals);
}
function isStableCoin(tokenSymbol) {
    return EQUIVALENT_STABLE_COINS.includes(tokenSymbol);
}
function areEquivalentStableCoins(token1, token2) {
    return isStableCoin(token1) && isStableCoin(token2);
}
function calculateStableCoinMinimumOut(amountIn, inputDecimals, outputDecimals, slippagePercent = 0.5) {
    // For stable coin swaps, we expect close to 1:1 ratio
    const amountInBigInt = typeof amountIn === 'string' ? BigInt(amountIn) : amountIn;
    // Adjust for decimal differences
    let adjustedAmount;
    if (inputDecimals === outputDecimals) {
        adjustedAmount = amountInBigInt;
    }
    else if (inputDecimals > outputDecimals) {
        // Input has more decimals, divide
        const decimalDiff = inputDecimals - outputDecimals;
        adjustedAmount = amountInBigInt / (10n ** BigInt(decimalDiff));
    }
    else {
        // Output has more decimals, multiply
        const decimalDiff = outputDecimals - inputDecimals;
        adjustedAmount = amountInBigInt * (10n ** BigInt(decimalDiff));
    }
    // Apply slippage (default 0.5% for stable coins)
    const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100));
    const minimumOut = (adjustedAmount * slippageMultiplier) / 10000n;
    return minimumOut;
}
function validateStableCoinOnlyAuction(winnerToken, requiredToken, sourceChainId, targetChainId) {
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
async function processEndedAuctions() {
    const allAuctions = (0, event_listner_1.getAllAuctions)();
    const currentTime = Math.floor(Date.now() / 1000);
    if (allAuctions.size === 0) {
        return;
    }
    for (const [intentId, auctionData] of allAuctions.entries()) {
        try {
            if (processingLocks.has(intentId)) {
                continue;
            }
            const auctionChain = getChainConfig(auctionData.sourceChain);
            if (!auctionChain) {
                console.error(`[-] Unknown chain: ${auctionData.sourceChain} for auction ${intentId.slice(0, 10)}...`);
                console.error(`[-] Available chains:`, Object.keys(config_1.CONFIG.chains));
                continue;
            }
            const provider = new ethers_1.ethers.JsonRpcProvider(auctionChain.rpcUrl);
            const auctionHub = new ethers_1.ethers.Contract(auctionChain.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, provider);
            const keeperWallet = new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, provider);
            // Get auction from blockchain to verify current status
            const auction = await auctionHub.auctions(intentId);
            // Check if auction exists on blockchain
            if (auction.seller === ethers_1.ethers.ZeroAddress) {
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
                continue;
            }
            console.log(`[!] Auction ${intentId.slice(0, 10)}... on ${auctionData.sourceChain} has ended. Processing...`);
            // Acquire processing lock to prevent concurrent processing
            processingLocks.add(intentId);
            console.log(`   - 🔒 Processing lock acquired for auction ${intentId.slice(0, 10)}...`);
            const bids = (0, event_listner_1.getBids)(intentId);
            console.log(`   - Found ${bids.length} bids for this auction`);
            if (bids.length === 0) {
                console.log("   - No bids found. Auction needs to be cancelled by seller (keeper cannot cancel).");
                // Note: cancelAuction() requires seller to call it, not keeper
                // The seller will need to call cancelAuction() manually
                // TODO: Add a keeper-specific cancel function in the contract or finalize with 0 amount
                processingLocks.delete(intentId); // Release lock
                continue;
            }
            let winner = null;
            let highestBid = BigInt(0);
            // Aggregate bids by bidder address (same logic as BidComponent.tsx)
            // A bidder can place multiple sequential bids, and they should be summed
            const bidderMap = new Map();
            for (const bid of bids) {
                const bidderKey = bid.bidder.toLowerCase();
                const bidAmount = BigInt(bid.amount);
                if (bidderMap.has(bidderKey)) {
                    // Add to existing bid total
                    const existing = bidderMap.get(bidderKey);
                    existing.totalAmount += bidAmount;
                }
                else {
                    // Create new entry
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
                console.log(`   - No valid bids met the reserve price (${ethers_1.ethers.formatUnits(reservePrice, 6)}). Auction needs to be cancelled by seller.`);
                // Note: cancelAuction() requires seller to call it, not keeper
                // The seller will need to call cancelAuction() manually
                // TODO: Add a keeper-specific cancel function or finalize-and-return function in the contract
                processingLocks.delete(intentId); // Release lock
                continue;
            }
            const winnerTokenSymbol = getTokenSymbol(winner.token, getChainConfig(winner.sourceChain)?.id || auctionChain.id);
            console.log(`   - Winner: ${winner.bidder} with bid of ${formatStableCoinAmount(winner.amount, winnerTokenSymbol)} ${winnerTokenSymbol}`);
            // Step 1: Finalize auction on-chain (mark winner and change status to Finalized)
            // Only finalize if status is Active
            if (auctionStatus === AuctionStatus.Active) {
                console.log("   - Step 1: Finalizing auction (marking winner)...");
                try {
                    const finalizeTx = await auctionHub.connect(keeperWallet).finalizeAuction(intentId, winner.bidder, winner.amount);
                    await finalizeTx.wait();
                    console.log(`   - ✓ Auction finalized (status: Active → Finalized). Tx: ${finalizeTx.hash}`);
                    // Update local auction status
                    auctionData.status = AuctionStatus.Finalized;
                    allAuctions.set(intentId, auctionData);
                }
                catch (error) {
                    console.error("   - ✗ Failed to finalize auction:", error?.message || error);
                    if (error?.message?.includes("Auction not ended")) {
                        console.error("   - ⚠️  Blockchain time may not have reached deadline yet. Will retry next cycle.");
                        processingLocks.delete(intentId); // Release lock before retry
                        continue;
                    }
                    // For other errors, log but continue to try settlement
                }
            }
            else if (auctionStatus === AuctionStatus.Finalized) {
                console.log("   - Step 1: Auction already finalized, proceeding to settlement...");
            }
            // Step 2: Cross-chain settlement (transfer funds)
            console.log("   - Step 2: Starting cross-chain settlement...");
            try {
                await settleCrossChainAuction(intentId, auction, winner, bids, auctionData.sourceChain);
                console.log(`   - ✓ Cross-chain settlement completed for auction ${intentId.slice(0, 10)}...`);
            }
            catch (error) {
                console.error(`   - ✗ Settlement failed for auction ${intentId.slice(0, 10)}...:`, error?.message || error);
                // Release lock and don't update status - will retry next cycle
                processingLocks.delete(intentId);
                continue;
            }
            // Update local auction status to settled
            auctionData.status = AuctionStatus.Settled;
            allAuctions.set(intentId, auctionData);
            // Release processing lock after successful completion
            processingLocks.delete(intentId);
            console.log(`   - 🔓 Processing lock released for auction ${intentId.slice(0, 10)}...`);
        }
        catch (error) {
            console.error(`   - Error processing auction ${intentId.slice(0, 10)}...:`, error);
            // Always release lock on error
            processingLocks.delete(intentId);
        }
    }
}
async function settleCrossChainAuction(intentId, auction, winner, allBids, sourceChain) {
    try {
        console.log(`   - Starting cross-chain settlement for auction ${intentId.slice(0, 10)}...`);
        const sourceChainConfig = getChainConfig(sourceChain);
        let targetChainConfig;
        if (auction.preferdChain !== undefined && auction.preferdChain !== null && auction.preferdChain !== "") {
            const numericId = Number(auction.preferdChain);
            if (!isNaN(numericId) && numericId !== 0) {
                targetChainConfig = Object.values(config_1.CONFIG.chains).find(c => Number(c.id) === numericId);
            }
            if (!targetChainConfig) {
                targetChainConfig = getChainConfig(auction.preferdChain);
            }
        }
        const targetConfig = targetChainConfig;
        const targetChain = targetConfig;
        if (!sourceChainConfig || !targetChain) {
            console.error(`Chain configuration not found:`);
            console.error(`- Source chain: ${sourceChain} -> ${sourceChainConfig ? 'Found' : 'NOT FOUND'}`);
            console.error(`- Target chain: ${auction.preferdChain} -> ${targetChain ? 'Found' : 'NOT FOUND'}`);
            console.error(`- Available chains:`, Object.keys(config_1.CONFIG.chains));
            throw new Error(`Chain configuration not found`);
        }
        console.log(`   - Source chain: ${sourceChain} (${sourceChainConfig.name})`);
        console.log(`   - Target chain: ${targetChain} (${targetConfig.name})`);
        const winnerChainConfig = getChainConfig(winner.sourceChain);
        if (!winnerChainConfig) {
            throw new Error(`Winner's chain configuration not found: ${winner.sourceChain}`);
        }
        const sourceProvider = new ethers_1.ethers.JsonRpcProvider(winnerChainConfig.rpcUrl);
        const bidManager = new ethers_1.ethers.Contract(winnerChainConfig.bidManagerAddress, BID_MANAGER_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, sourceProvider));
        // Release the winning bid from BidManager
        console.log(`   - Releasing winning bid from BidManager on ${winner.sourceChain}...`);
        const releaseTx = await bidManager.releaseWinningBid(intentId, winner.bidder, auction.seller);
        await releaseTx.wait();
        console.log(`   - ✅ Winning bid released to seller on ${winnerChainConfig.name}. Tx: ${releaseTx.hash}`);
        const winnerTokenAddress = winner.token;
        const requiredTokenAddress = auction.preferdToken || auction.preferdToken;
        const bidAmount = winner.amount;
        validateStableCoinOnlyAuction(winnerTokenAddress, requiredTokenAddress, winnerChainConfig.id, targetConfig.id);
        const winnerTokenSymbol = getTokenSymbol(winnerTokenAddress, winnerChainConfig.id);
        const requiredTokenSymbol = getTokenSymbol(requiredTokenAddress, targetConfig.id);
        console.log(`   - Winner token: ${winnerTokenSymbol} (${formatStableCoinAmount(bidAmount, winnerTokenSymbol)})`);
        console.log(`   - Required token: ${requiredTokenSymbol}`);
        console.log(`   - Current location: ${winnerChainConfig.name} (${winnerChainConfig.id})`);
        console.log(`   - Preferred destination: ${targetConfig.name} (${targetConfig.id})`);
        if (winnerChainConfig.id === targetConfig.id && winnerTokenSymbol === requiredTokenSymbol) {
            console.log(`   - 🎉 Funds already on seller's preferred chain with correct token!`);
            console.log(`   - ✅ No additional action needed - settlement complete`);
        }
        else if (winnerChainConfig.id !== targetConfig.id && winnerTokenSymbol === requiredTokenSymbol) {
            console.log(`   - 🌉 Cross-chain bridge needed (same token, different chain)`);
            console.log(`   - 💰 ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol}`);
            console.log(`   - 📍 From: ${winnerChainConfig.name} → To: ${targetConfig.name}`);
            console.log(`   - 💡 Seller will bridge via frontend "Claim Tokens" button using Avail Nexus SDK`);
        }
        else if (winnerTokenSymbol !== requiredTokenSymbol) {
            console.log(`   - 🔄 Bridge + Swap needed (different token and/or chain)`);
            console.log(`   - 💰 ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol} → ${requiredTokenSymbol}`);
            console.log(`   - 📍 From: ${winnerChainConfig.name} → To: ${targetConfig.name}`);
            console.log(`   - 💡 Seller will bridge and swap via frontend "Claim Tokens" button using Avail Nexus SDK`);
        }
        else {
            console.log(`   - 🌉 Cross-chain delivery scenario detected`);
            console.log(`   - 💡 Seller will claim via frontend using Avail Nexus SDK`);
        }
        console.log(`   - 📝 Frontend claim demonstrates proper Nexus SDK usage (user-initiated transfers)`);
        console.log(`   - ✅ Fund release phase completed`);
        // Refund losing bidders
        console.log(`   - Refunding losing bidders...`);
        for (const bid of allBids) {
            if (bid.bidder !== winner.bidder) {
                try {
                    const bidChainConfig = getChainConfig(bid.sourceChain);
                    if (!bidChainConfig)
                        continue;
                    const bidProvider = new ethers_1.ethers.JsonRpcProvider(bidChainConfig.rpcUrl);
                    const bidManagerContract = new ethers_1.ethers.Contract(bidChainConfig.bidManagerAddress, BID_MANAGER_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, bidProvider));
                    const refundTx = await bidManagerContract.refundBid(intentId, bid.bidder);
                    await refundTx.wait();
                    console.log(`   - Refunded ${bid.bidder} on ${bid.sourceChain}. Tx: ${refundTx.hash}`);
                }
                catch (error) {
                    console.error(`   - Failed to refund bidder ${bid.bidder}:`, error);
                }
            }
        }
        // Finally, release the NFT to the winner
        console.log(`   - Releasing NFT to winner...`);
        // Use sourceChain from function parameter, not from auction object
        const auctionChainConfig = getChainConfig(sourceChain);
        if (!auctionChainConfig) {
            throw new Error(`Auction chain configuration not found for sourceChain: ${sourceChain}`);
        }
        const auctionProvider = new ethers_1.ethers.JsonRpcProvider(auctionChainConfig.rpcUrl);
        const auctionHub = new ethers_1.ethers.Contract(auctionChainConfig.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, auctionProvider));
        const nftReleaseTx = await auctionHub.NFTrelease(intentId);
        await nftReleaseTx.wait();
        console.log(`   - NFT released to winner. Tx: ${nftReleaseTx.hash}`);
        console.log(`   - Cross-chain settlement completed successfully for auction ${intentId.slice(0, 10)}...`);
    }
    catch (error) {
        console.error(`   - Error in cross-chain settlement for auction ${intentId.slice(0, 10)}...:`, error);
        throw error;
    }
}
