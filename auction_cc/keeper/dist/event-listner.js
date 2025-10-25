"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addBid = addBid;
exports.getBids = getBids;
exports.getAllBids = getAllBids;
exports.addAuction = addAuction;
exports.getAuction = getAuction;
exports.getAllAuctions = getAllAuctions;
exports.updateAuctionStatus = updateAuctionStatus;
exports.startEventListeners = startEventListeners;
exports.restartEventListeners = restartEventListeners;
exports.cleanupEventListeners = cleanupEventListeners;
const ethers_1 = require("ethers");
const config_1 = require("./config");
const db_service_1 = require("./DB/db_service");
const AUCTION_HUB_ABI_json_1 = __importDefault(require("../src/ABI/AUCTION_HUB_ABI.json"));
const BID_MANAGER_ABI_json_1 = __importDefault(require("../src/ABI/BID_MANAGER_ABI.json"));
function debugEventStructure(event, eventType = 'unknown') {
    console.log(`🔍 DEBUG: ${eventType} event structure:`);
    console.log(`   - Direct properties:`, {
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber,
        logIndex: event.logIndex,
        transactionIndex: event.transactionIndex,
        address: event.address,
        topics: event.topics?.length || 0
    });
    if (event.log) {
        console.log(`   - Log properties:`, {
            transactionHash: event.log.transactionHash,
            blockNumber: event.log.blockNumber,
            logIndex: event.log.logIndex,
            transactionIndex: event.log.transactionIndex,
            address: event.log.address
        });
    }
    if (event.receipt) {
        console.log(`   - Receipt properties:`, {
            transactionHash: event.receipt.transactionHash,
            blockNumber: event.receipt.blockNumber,
            status: event.receipt.status
        });
    }
    console.log(`   - All keys:`, Object.keys(event));
}
let activeContracts = [];
const processedEvents = new Set();
async function addBid(intentId, bid) {
    try {
        await db_service_1.dbService.addBid(bid);
    }
    catch (error) {
        console.error('❌ Failed to add bid to database:', error);
        throw error;
    }
}
async function getBids(intentId) {
    try {
        const bids = await db_service_1.dbService.getBids(intentId);
        return bids.map(bid => ({
            intentId: bid.intentId,
            bidder: bid.bidder,
            amount: bid.amount,
            token: bid.token,
            sourceChain: bid.sourceChain,
            transactionHash: bid.transactionHash,
            timestamp: bid.timestamp
        }));
    }
    catch (error) {
        console.error('❌ Failed to get bids from database:', error);
        return [];
    }
}
async function getAllBids() {
    try {
        const allBids = await db_service_1.dbService.getAllBids();
        const bidMap = new Map();
        allBids.forEach(({ intentId, bids }) => {
            const formattedBids = bids.map(bid => ({
                intentId: bid.intentId,
                bidder: bid.bidder,
                amount: bid.amount,
                token: bid.token,
                sourceChain: bid.sourceChain,
                transactionHash: bid.transactionHash,
                timestamp: bid.timestamp
            }));
            bidMap.set(intentId, formattedBids);
        });
        return bidMap;
    }
    catch (error) {
        console.error('❌ Failed to get all bids from database:', error);
        return new Map();
    }
}
async function addAuction(auctionId, auction) {
    try {
        await db_service_1.dbService.addAuction(auction);
    }
    catch (error) {
        console.error('❌ Failed to add auction to database:', error);
        throw error;
    }
}
async function getAuction(auctionId) {
    try {
        const auction = await db_service_1.dbService.getAuction(auctionId);
        if (!auction)
            return undefined;
        return {
            intentId: auction.intentId,
            seller: auction.seller,
            nftContract: auction.nftContract,
            tokenId: auction.tokenId,
            startingPrice: auction.startingPrice,
            reservePrice: auction.reservePrice,
            deadline: auction.deadline,
            preferdToken: auction.preferdToken,
            preferdChain: auction.preferdChain,
            sourceChain: auction.sourceChain,
            status: auction.status,
            txHash: auction.txHash,
            timestamp: auction.timestamp,
            cancelTxHash: auction.cancelTxHash,
            cancelTimestamp: auction.cancelTimestamp
        };
    }
    catch (error) {
        console.error('❌ Failed to get auction from database:', error);
        return undefined;
    }
}
async function getAllAuctions() {
    try {
        const auctions = await db_service_1.dbService.getAllAuctions();
        const auctionMap = new Map();
        auctions.forEach(auction => {
            auctionMap.set(auction.intentId, {
                intentId: auction.intentId,
                seller: auction.seller,
                nftContract: auction.nftContract,
                tokenId: auction.tokenId,
                startingPrice: auction.startingPrice,
                reservePrice: auction.reservePrice,
                deadline: auction.deadline,
                preferdToken: auction.preferdToken,
                preferdChain: auction.preferdChain,
                sourceChain: auction.sourceChain,
                status: auction.status,
                txHash: auction.txHash,
                timestamp: auction.timestamp,
                cancelTxHash: auction.cancelTxHash,
                cancelTimestamp: auction.cancelTimestamp
            });
        });
        return auctionMap;
    }
    catch (error) {
        console.error('❌ Failed to get all auctions from database:', error);
        return new Map();
    }
}
async function updateAuctionStatus(intentId, status, additionalData) {
    try {
        await db_service_1.dbService.updateAuctionStatus(intentId, status, additionalData);
    }
    catch (error) {
        console.error('❌ Failed to update auction status in database:', error);
        throw error;
    }
}
function cleanupExistingListeners() {
    console.log(`   - Cleaning up ${activeContracts.length} existing event listeners...`);
    for (const contract of activeContracts) {
        try {
            contract.removeAllListeners();
        }
        catch (error) {
            console.warn(`   - Warning: Failed to remove listeners from contract:`, error);
        }
    }
    activeContracts = [];
}
async function startEventListeners() {
    console.log("[*] Starting event listeners...");
    let totalListeners = 0;
    for (const chain of Object.values(config_1.CONFIG.chains)) {
        if (!chain.bidManagerAddress) {
            console.warn(`   - Skipping ${chain.name}: No bidManagerAddress configured`);
            continue;
        }
        try {
            const provider = new ethers_1.ethers.JsonRpcProvider(chain.rpcUrl);
            const bidManagerContract = new ethers_1.ethers.Contract(chain.bidManagerAddress, BID_MANAGER_ABI_json_1.default, provider);
            activeContracts.push(bidManagerContract);
            bidManagerContract.on("BidPlaced", async (intentId, bidder, token, amount, event) => {
                try {
                    let txHash = null;
                    if (event.log?.transactionHash) {
                        txHash = event.log.transactionHash;
                    }
                    else if (event.transactionHash) {
                        txHash = event.transactionHash;
                    }
                    else if (event.receipt?.transactionHash) {
                        txHash = event.receipt.transactionHash;
                    }
                    else if (event.blockNumber && event.transactionIndex !== undefined) {
                        try {
                            const block = await provider.getBlock(event.blockNumber);
                            if (block && block.transactions[event.transactionIndex]) {
                                txHash = block.transactions[event.transactionIndex];
                            }
                        }
                        catch (error) {
                            console.warn('   - Could not fetch transaction from block:', error);
                        }
                    }
                    if (!txHash) {
                        console.warn(`⚠️  Could not extract transaction hash from bid event - will generate fallback ID`);
                        debugEventStructure(event, 'BidPlaced');
                        console.warn(`   - Event keys:`, Object.keys(event));
                        console.warn(`   - Will proceed with bid processing using generated transaction ID`);
                        txHash = 'unknown';
                    }
                    const blockNumber = event.log?.blockNumber || event.blockNumber || 0;
                    const logIndex = event.log?.logIndex !== undefined ? event.log.logIndex :
                        event.logIndex !== undefined ? event.logIndex : Math.random();
                    const eventId = txHash !== 'unknown'
                        ? `${txHash}-${logIndex}-bid-${intentId}`
                        : `unknown-${Date.now()}-${Math.random()}-bid-${intentId}`;
                    console.log(`🎯 Bid event detected: ${eventId}`);
                    console.log(`   - Transaction Hash: ${txHash}`);
                    console.log(`   - Block Number: ${blockNumber}`);
                    if (processedEvents.has(eventId)) {
                        console.log(`   - Skipping duplicate bid event: ${eventId}`);
                        return;
                    }
                    processedEvents.add(eventId);
                    const bid = {
                        intentId,
                        bidder,
                        amount: amount.toString(),
                        token,
                        sourceChain: chain.name,
                        transactionHash: txHash,
                        timestamp: new Date().toISOString()
                    };
                    console.log(`🎉 NEW BID EVENT on ${chain.name}! Processing...`);
                    console.log(`   - Intent ID: ${intentId}`);
                    console.log(`   - Bidder: ${bidder}`);
                    console.log(`   - Amount: ${amount.toString()}`);
                    console.log(`   - Token: ${token}`);
                    console.log(`   - TX Hash: ${txHash}`);
                    await addBid(intentId, bid);
                }
                catch (error) {
                    console.error('❌ Error processing bid event:', error);
                }
            });
            totalListeners++;
            console.log(`   - ✅ Listening for bids on ${chain.name}`);
            if (chain.auctionHubAddress) {
                const auctionHub = new ethers_1.ethers.Contract(chain.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, provider);
                activeContracts.push(auctionHub);
                auctionHub.on("AuctionCreated", async (intentId, seller, nftContract, tokenId, startingPrice, reservePrice, deadline, preferdToken, preferdChain, event) => {
                    try {
                        const txHash = event.log?.transactionHash || event.transactionHash || 'unknown';
                        const blockNumber = event.log?.blockNumber || event.blockNumber || 0;
                        const logIndex = event.log?.logIndex !== undefined ? event.log.logIndex :
                            event.logIndex !== undefined ? event.logIndex : Math.random();
                        const eventId = `${txHash}-${logIndex}-auction-${intentId}-${nftContract}-${tokenId}`;
                        console.log(`🎯 Auction event detected: ${eventId}`);
                        console.log(`   - Transaction Hash: ${txHash}`);
                        console.log(`   - Block Number: ${blockNumber}`);
                        if (processedEvents.has(eventId)) {
                            console.log(`   - Skipping duplicate auction event: ${eventId}`);
                            return;
                        }
                        processedEvents.add(eventId);
                        console.log(`🎉 AuctionCreated EVENT DETECTED on ${chain.name}!`);
                        console.log(`   Intent ID: ${intentId}`);
                        console.log(`   Seller: ${seller}`);
                        console.log(`   NFT: ${nftContract} #${tokenId}`);
                        console.log(`   Starting Price: ${startingPrice.toString()}`);
                        console.log(`   Reserve Price: ${reservePrice.toString()}`);
                        console.log(`   Deadline: ${deadline.toString()}`);
                        console.log(`   Preferred Token: ${preferdToken}`);
                        console.log(`   Preferred Chain: ${preferdChain.toString()}`);
                        console.log(`   TX Hash: ${txHash}`);
                        if (!txHash || txHash === 'unknown') {
                            console.error(`❌ Invalid transaction hash for auction ${intentId}: ${txHash}`);
                            console.error(`   - Event object:`, {
                                transactionHash: event.transactionHash,
                                log: event.log ? {
                                    transactionHash: event.log.transactionHash,
                                    blockNumber: event.log.blockNumber,
                                    logIndex: event.log.logIndex
                                } : 'No log object'
                            });
                            return;
                        }
                        const auction = {
                            intentId,
                            seller,
                            nftContract,
                            tokenId: tokenId.toString(),
                            startingPrice: startingPrice.toString(),
                            reservePrice: reservePrice.toString(),
                            deadline: deadline.toString(),
                            preferdToken,
                            preferdChain: preferdChain.toString(),
                            sourceChain: chain.name,
                            status: 0,
                            txHash: txHash,
                            timestamp: new Date().toISOString()
                        };
                        await addAuction(intentId, auction);
                    }
                    catch (error) {
                        console.error('❌ Error processing auction event:', error);
                    }
                });
                auctionHub.on("AuctionCancelled", async (intentId, event) => {
                    try {
                        const txHash = event.log?.transactionHash || event.transactionHash || 'unknown';
                        const blockNumber = event.log?.blockNumber || event.blockNumber || 0;
                        const logIndex = event.log?.logIndex !== undefined ? event.log.logIndex :
                            event.logIndex !== undefined ? event.logIndex : Math.random();
                        const eventId = `${txHash}-${logIndex}-cancelled-${intentId}`;
                        console.log(`🎯 Auction cancelled event detected: ${eventId}`);
                        console.log(`   - Transaction Hash: ${txHash}`);
                        console.log(`   - Block Number: ${blockNumber}`);
                        if (processedEvents.has(eventId)) {
                            console.log(`   - Skipping duplicate cancelled event: ${eventId}`);
                            return;
                        }
                        processedEvents.add(eventId);
                        console.log(`🚫 AUCTION CANCELLED EVENT DETECTED on ${chain.name}!`);
                        console.log(`   Intent ID: ${intentId}`);
                        console.log(`   TX Hash: ${txHash}`);
                        await updateAuctionStatus(intentId, 3, {
                            cancelTxHash: txHash,
                            cancelTimestamp: new Date().toISOString()
                        });
                    }
                    catch (error) {
                        console.error('❌ Error processing auction cancelled event:', error);
                    }
                });
                totalListeners += 2;
                console.log(`   - ✅ Listening for auctions on ${chain.name} AuctionHub`);
            }
        }
        catch (error) {
            console.error(`   - ❌ Failed to setup listeners for ${chain.name}:`, error);
        }
    }
    console.log(`[*] Event listeners initialized: ${totalListeners} listeners across ${Object.keys(config_1.CONFIG.chains).length} chains`);
}
async function restartEventListeners() {
    console.log("[*] Restarting event listeners for fresh connections...");
    cleanupExistingListeners();
    await startEventListeners();
    console.log("[✓] Event listeners restarted successfully");
}
function cleanupEventListeners() {
    console.log("[*] Cleaning up all event listeners...");
    cleanupExistingListeners();
    console.log("[✓] All event listeners cleaned up");
}
