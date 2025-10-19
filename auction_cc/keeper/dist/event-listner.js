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
exports.startEventListeners = startEventListeners;
exports.restartEventListeners = restartEventListeners;
exports.cleanupEventListeners = cleanupEventListeners;
const ethers_1 = require("ethers");
const config_1 = require("./config");
const AUCTION_HUB_ABI_json_1 = __importDefault(require("../src/ABI/AUCTION_HUB_ABI.json"));
const BID_MANAGER_ABI_json_1 = __importDefault(require("../src/ABI/BID_MANAGER_ABI.json"));
const bidStore = new Map();
const auctionStore = new Map();
// Store active contracts for cleanup
let activeContracts = [];
// Track processed events to prevent duplicates
const processedEvents = new Set();
function addBid(intentId, bid) {
    if (!bidStore.has(intentId)) {
        bidStore.set(intentId, []);
    }
    const bids = bidStore.get(intentId);
    // Check if this bidder already has a bid from the same chain
    const existingBidIndex = bids.findIndex((b) => b.bidder.toLowerCase() === bid.bidder.toLowerCase() &&
        b.sourceChain === bid.sourceChain &&
        b.token.toLowerCase() === bid.token.toLowerCase());
    if (existingBidIndex !== -1) {
        // Update existing bid - the event emits the INCREMENTAL amount, so we ADD it
        const oldAmount = bids[existingBidIndex].amount;
        const newAmount = BigInt(oldAmount) + BigInt(bid.amount);
        bids[existingBidIndex].amount = newAmount.toString();
        bids[existingBidIndex].timestamp = bid.timestamp;
        bids[existingBidIndex].transactionHash = bid.transactionHash;
        console.log(`[+] Updated Bid for ${intentId.slice(0, 10)}... on ${bid.sourceChain} - Bidder: ${bid.bidder.slice(0, 8)}... - New Total: ${ethers_1.ethers.formatUnits(newAmount, 6)}`);
    }
    else {
        // New bid from this user/chain combination
        bids.push(bid);
        console.log(`[+] New Bid Recorded for ${intentId.slice(0, 10)}... on ${bid.sourceChain} - Bidder: ${bid.bidder.slice(0, 8)}... - Amount: ${ethers_1.ethers.formatUnits(bid.amount, 6)}`);
    }
}
function getBids(intentId) {
    return bidStore.get(intentId) || [];
}
function getAllBids() {
    return bidStore;
}
function addAuction(auctionId, auction) {
    auctionStore.set(auctionId, auction);
    console.log(`[+] New Auction Recorded: ${auctionId.slice(0, 10)}... on ${auction.sourceChain} - Reserve: ${ethers_1.ethers.formatUnits(auction.reservePrice, 6)}`);
}
function getAuction(auctionId) {
    return auctionStore.get(auctionId);
}
function getAllAuctions() {
    return auctionStore;
}
function cleanupExistingListeners() {
    console.log(`   - Cleaning up ${activeContracts.length} existing event listeners...`);
    // Remove all listeners from existing contracts
    for (const contract of activeContracts) {
        try {
            contract.removeAllListeners();
        }
        catch (error) {
            console.warn(`   - Warning: Failed to remove listeners from contract:`, error);
        }
    }
    // Clear the active contracts array
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
            // BidManager contract
            const bidManagerContract = new ethers_1.ethers.Contract(chain.bidManagerAddress, BID_MANAGER_ABI_json_1.default, provider);
            activeContracts.push(bidManagerContract);
            // Listen for new bid events (real-time)
            bidManagerContract.on("BidPlaced", (intentId, bidder, token, amount, event) => {
                // Create unique event identifier to prevent duplicates
                const eventId = `${event.transactionHash}-${event.logIndex || event.index || 0}-bid`;
                // Skip if we've already processed this event
                if (processedEvents.has(eventId)) {
                    console.log(`   - Skipping duplicate bid event: ${eventId}`);
                    return;
                }
                processedEvents.add(eventId);
                const bid = {
                    intentId,
                    bidder,
                    amount,
                    token,
                    sourceChain: chain.name,
                    transactionHash: event.transactionHash,
                    timestamp: new Date().toISOString()
                };
                addBid(intentId, bid);
            });
            totalListeners++;
            console.log(`   - ✅ Listening for bids on ${chain.name}`);
            // AuctionHub contract (if available)
            if (chain.auctionHubAddress) {
                const auctionHub = new ethers_1.ethers.Contract(chain.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, provider);
                activeContracts.push(auctionHub);
                // Listen for new auction events (real-time)
                auctionHub.on("AuctionCreated", (intentId, seller, nftContract, tokenId, startingPrice, reservePrice, deadline, preferdToken, preferdChain, event) => {
                    // Create unique event identifier to prevent duplicates
                    const eventId = `${event.transactionHash}-${event.logIndex || event.index || 0}-auction`;
                    // Skip if we've already processed this event
                    if (processedEvents.has(eventId)) {
                        console.log(`   - Skipping duplicate auction event: ${eventId}`);
                        return;
                    }
                    processedEvents.add(eventId);
                    console.log(`🎉 AuctionCreated EVENT DETECTED on ${chain.name}!`);
                    console.log(`   Intent ID: ${intentId}`);
                    console.log(`   Seller: ${seller}`);
                    console.log(`   NFT: ${nftContract} #${tokenId}`);
                    console.log(`   TX Hash: ${event.log.transactionHash}`);
                    const auction = {
                        intentId,
                        seller,
                        nftContract,
                        tokenId,
                        startingPrice,
                        reservePrice,
                        deadline,
                        preferdToken,
                        preferdChain,
                        sourceChain: chain.name,
                        status: 0, // Active
                        txHash: event.log.transactionHash,
                        timestamp: new Date().toISOString()
                    };
                    addAuction(intentId, auction);
                });
                totalListeners++;
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
    // Clean up existing listeners
    cleanupExistingListeners();
    // Start fresh listeners
    await startEventListeners();
    console.log("[✓] Event listeners restarted successfully");
}
// Cleanup function for graceful shutdown
function cleanupEventListeners() {
    console.log("[*] Cleaning up all event listeners...");
    cleanupExistingListeners();
    console.log("[✓] All event listeners cleaned up");
}
