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
const AuctionStatus = {
    Created: 0,
    Active: 1,
    Finalized: 2,
    Settled: 3,
    Cancelled: 4
};
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
        '0xf08A50178dfcDe18524640EA6618a1f965821715': 'USDC',
        '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0': 'USDT',
    },
    421614: {
        '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d': 'USDC',
        '0xb9a4873d8d2C22e56b8574e8605644d08E047434': 'USDT',
    },
    84532: {
        '0x036CbD53842c5426634e7929541eC2318f3dCF7e': 'USDC',
        '0xf7e53b20f39a5f8c35005fEf37eef03A7b0d0B5a': 'USDT',
    },
    11155420: {
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': 'USDC',
        '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': 'USDT',
    },
};
const STABLE_COIN_DECIMALS = {
    'USDC': 6,
    'USDT': 6,
    'USDC.e': 6,
};
const EQUIVALENT_STABLE_COINS = ['USDC', 'USDT', 'USDC.e'];
function getTokenSymbol(tokenAddress, chainId) {
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
    console.log(`\n[*] 📊 Processing ended auctions... (${new Date().toLocaleTimeString()}) - 10s interval`);
    const allAuctions = await (0, event_listner_1.getAllAuctions)();
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
                console.error(`[-] Available chains:`, Object.keys(config_1.CONFIG.chains));
                continue;
            }
            const provider = new ethers_1.ethers.JsonRpcProvider(auctionChain.rpcUrl);
            const auctionHub = new ethers_1.ethers.Contract(auctionChain.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, provider);
            const keeperWallet = new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, provider);
            const auction = await auctionHub.auctions(intentId);
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
            if (auctionDeadline > currentTime) {
                continue;
            }
            if (auctionStatus === AuctionStatus.Settled || auctionStatus === AuctionStatus.Cancelled) {
                console.log(`   - Auction ${intentId.slice(0, 10)}... already completed (status: ${auctionStatus}), skipping...`);
                if (auctionData.status !== auctionStatus) {
                    await (0, event_listner_1.updateAuctionStatus)(intentId, auctionStatus);
                }
                continue;
            }
            console.log(`[!] Auction ${intentId.slice(0, 10)}... on ${auctionData.sourceChain} has ended. Processing...`);
            processingLocks.add(intentId);
            console.log(`   - 🔒 Processing lock acquired for auction ${intentId.slice(0, 10)}...`);
            const bids = await (0, event_listner_1.getBids)(intentId);
            console.log(`   - Found ${bids.length} bids for this auction`);
            if (bids.length === 0) {
                console.log("   - No bids found. Auction needs to be cancelled by seller (keeper cannot cancel).");
                processingLocks.delete(intentId);
                continue;
            }
            let winner = null;
            let highestBid = BigInt(0);
            const bidderMap = new Map();
            for (const bid of bids) {
                const bidderKey = bid.bidder.toLowerCase();
                const bidAmount = BigInt(bid.amount);
                if (bidderMap.has(bidderKey)) {
                    const existing = bidderMap.get(bidderKey);
                    existing.totalAmount += bidAmount;
                }
                else {
                    bidderMap.set(bidderKey, {
                        bidder: bid.bidder,
                        totalAmount: bidAmount,
                        token: bid.token,
                        sourceChain: bid.sourceChain
                    });
                }
            }
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
                processingLocks.delete(intentId);
                continue;
            }
            if (auctionStatus === AuctionStatus.Active) {
                console.log("   - Step 1: Finalizing auction (marking winner)...");
                try {
                    const finalizeTx = await auctionHub.connect(keeperWallet).finalizeAuction(intentId, winner.bidder, winner.amount);
                    await finalizeTx.wait();
                    console.log(`   - ✓ Auction finalized (status: Active → Finalized). Tx: ${finalizeTx.hash}`);
                    await (0, event_listner_1.updateAuctionStatus)(intentId, AuctionStatus.Finalized);
                }
                catch (error) {
                    console.error("   - ✗ Failed to finalize auction:", error?.message || error);
                    if (error?.message?.includes("Auction not ended")) {
                        console.error("   - ⚠️  Blockchain time may not have reached deadline yet. Will retry next cycle.");
                        processingLocks.delete(intentId);
                        continue;
                    }
                }
            }
            else if (auctionStatus === AuctionStatus.Finalized) {
                console.log("   - Step 1: Auction already finalized, proceeding to settlement...");
            }
            console.log("   - Step 2: Starting cross-chain settlement...");
            try {
                await settleCrossChainAuction(intentId, auction, winner, bids, auctionData.sourceChain);
                console.log(`   - ✓ Cross-chain settlement completed for auction ${intentId.slice(0, 10)}...`);
                await (0, event_listner_1.updateAuctionStatus)(intentId, AuctionStatus.Settled);
            }
            catch (error) {
                console.error(`   - ✗ Settlement failed for auction ${intentId.slice(0, 10)}...:`, error?.message || error);
                processingLocks.delete(intentId);
                continue;
            }
            processingLocks.delete(intentId);
            console.log(`   - 🔓 Processing lock released for auction ${intentId.slice(0, 10)}...`);
        }
        catch (error) {
            console.error(`   - Error processing auction ${intentId.slice(0, 10)}...:`, error);
            processingLocks.delete(intentId);
        }
    }
    console.log(`[*] Finished processing auctions (${new Date().toLocaleTimeString()})\n`);
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
        console.log(`   - Target chain: ${targetChain.name} (${targetConfig.id})`);
        const winnerChainConfig = getChainConfig(winner.sourceChain);
        if (!winnerChainConfig) {
            throw new Error(`Winner's chain configuration not found: ${winner.sourceChain}`);
        }
        const sourceProvider = new ethers_1.ethers.JsonRpcProvider(winnerChainConfig.rpcUrl);
        const bidManager = new ethers_1.ethers.Contract(winnerChainConfig.bidManagerAddress, BID_MANAGER_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, sourceProvider));
        console.log(`   - Releasing winning bid from BidManager on ${winner.sourceChain}...`);
        const releaseTx = await bidManager.releaseWinningBid(intentId, winner.bidder, auction.seller);
        await releaseTx.wait();
        console.log(`   - ✅ Winning bid released to seller on ${winnerChainConfig.name}. Tx: ${releaseTx.hash}`);
        const winnerTokenAddress = winner.token;
        const requiredTokenAddress = auction.preferdToken;
        const bidAmount = winner.amount;
        validateStableCoinOnlyAuction(winnerTokenAddress, requiredTokenAddress, winnerChainConfig.id, targetConfig.id);
        const winnerTokenSymbol = getTokenSymbol(winnerTokenAddress, winnerChainConfig.id);
        const requiredTokenSymbol = getTokenSymbol(requiredTokenAddress, targetConfig.id);
        console.log(`   - Winner token: ${winnerTokenSymbol} (${formatStableCoinAmount(bidAmount, winnerTokenSymbol)})`);
        console.log(`   - Required token: ${requiredTokenSymbol}`);
        console.log(`   - Current location: ${winnerChainConfig.name} (${winnerChainConfig.id})`);
        console.log(`   - Preferred destination: ${targetConfig.name} (${targetConfig.id})`);
        if (winnerChainConfig.id === targetConfig.id && winnerTokenSymbol === requiredTokenSymbol) {
            console.log(`   - 🎉 Perfect match! Funds already on seller's preferred chain with correct token!`);
            console.log(`   - ✅ No additional action needed - settlement complete`);
            console.log(`   - 💰 Seller has: ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol} on ${winnerChainConfig.name}`);
        }
        else {
            console.log(`   - 🔄 Cross-chain/token transfer needed - manual claim required`);
            console.log(`   - 💰 Available: ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol} on ${winnerChainConfig.name}`);
            console.log(`   - 🎯 Target: ${requiredTokenSymbol} on ${targetConfig.name}`);
            if (winnerChainConfig.id !== targetConfig.id && winnerTokenSymbol === requiredTokenSymbol) {
                console.log(`   - 🌉 Same token, different chain - bridge needed`);
                console.log(`   - 📍 Bridge: ${winnerChainConfig.name} → ${targetConfig.name}`);
            }
            else if (winnerChainConfig.id === targetConfig.id && winnerTokenSymbol !== requiredTokenSymbol) {
                console.log(`   - 🔄 Same chain, different token - swap needed`);
                console.log(`   - 🔀 Swap: ${winnerTokenSymbol} → ${requiredTokenSymbol} on ${winnerChainConfig.name}`);
            }
            else {
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
        console.log(`   - Refunding losing bidders...`);
        for (const bid of allBids) {
            if (bid.bidder.toLowerCase() !== winner.bidder.toLowerCase()) {
                try {
                    const bidChainConfig = getChainConfig(bid.sourceChain);
                    if (!bidChainConfig) {
                        console.warn(`   - ⚠️  Chain config not found for bid on ${bid.sourceChain}, skipping refund`);
                        continue;
                    }
                    const bidProvider = new ethers_1.ethers.JsonRpcProvider(bidChainConfig.rpcUrl);
                    const bidManagerContract = new ethers_1.ethers.Contract(bidChainConfig.bidManagerAddress, BID_MANAGER_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, bidProvider));
                    const refundTx = await bidManagerContract.refundBid(intentId, bid.bidder);
                    await refundTx.wait();
                    const bidTokenSymbol = getTokenSymbol(bid.token, bidChainConfig.id);
                    const bidAmount = formatStableCoinAmount(bid.amount, bidTokenSymbol);
                    console.log(`   - ✅ Refunded ${bid.bidder.slice(0, 8)}... → ${bidAmount} ${bidTokenSymbol} on ${bid.sourceChain}. Tx: ${refundTx.hash}`);
                }
                catch (error) {
                    console.error(`   - ❌ Failed to refund bidder ${bid.bidder.slice(0, 8)}... on ${bid.sourceChain}:`, error);
                }
            }
        }
        console.log(`   - Releasing NFT to winner...`);
        const auctionChainConfig = getChainConfig(sourceChain);
        if (!auctionChainConfig) {
            throw new Error(`Auction chain configuration not found for sourceChain: ${sourceChain}`);
        }
        const auctionProvider = new ethers_1.ethers.JsonRpcProvider(auctionChainConfig.rpcUrl);
        const auctionHub = new ethers_1.ethers.Contract(auctionChainConfig.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, auctionProvider));
        const nftReleaseTx = await auctionHub.NFTrelease(intentId);
        await nftReleaseTx.wait();
        console.log(`   - ✅ NFT released to winner ${winner.bidder.slice(0, 8)}... Tx: ${nftReleaseTx.hash}`);
        console.log(`   - 🎨 NFT Contract: ${auction.nftContract} Token ID: ${auction.tokenId}`);
        console.log(`   - ✅ Cross-chain settlement completed successfully for auction ${intentId.slice(0, 10)}...`);
        console.log(`   - 🏆 Winner: ${winner.bidder.slice(0, 8)}... gets the NFT`);
        console.log(`   - 💰 Seller: ${auction.seller.slice(0, 8)}... gets ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol}`);
        console.log(`   - 📱 Seller uses frontend to claim cross-chain funds if needed`);
    }
    catch (error) {
        console.error(`   - ❌ Error in cross-chain settlement for auction ${intentId.slice(0, 10)}...:`, error);
        throw error;
    }
}
