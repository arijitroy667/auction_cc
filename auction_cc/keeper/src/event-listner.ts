import {ethers} from "ethers";
import {CONFIG} from "./config";
import AUCTION_HUB_ABI from "../src/ABI/AUCTION_HUB_ABI.json";
import BID_MANAGER_ABI from "../src/ABI/BID_MANAGER_ABI.json";

const bidStore = new Map<string, any[]>();
const auctionStore = new Map<string, any>();

// Store active contracts for cleanup
let activeContracts: ethers.Contract[] = [];

// Track processed events to prevent duplicates
const processedEvents = new Set<string>();

export function addBid(intentId: string, bid: any) {
    if (!bidStore.has(intentId)) {
        bidStore.set(intentId, []);
    }
    
    const bids = bidStore.get(intentId)!;
    
    // Check if this bidder already has a bid from the same chain
    const existingBidIndex = bids.findIndex(
        (b) => b.bidder.toLowerCase() === bid.bidder.toLowerCase() && 
               b.sourceChain === bid.sourceChain &&
               b.token.toLowerCase() === bid.token.toLowerCase()
    );
    
    if (existingBidIndex !== -1) {
        // Update existing bid - the event emits the INCREMENTAL amount, so we ADD it
        const oldAmount = bids[existingBidIndex].amount;
        const newAmount = BigInt(oldAmount) + BigInt(bid.amount);
        bids[existingBidIndex].amount = newAmount.toString();
        bids[existingBidIndex].timestamp = bid.timestamp;
        bids[existingBidIndex].transactionHash = bid.transactionHash;
        console.log(`[+] Updated Bid for ${intentId.slice(0, 10)}... on ${bid.sourceChain} - Bidder: ${bid.bidder.slice(0, 8)}... - New Total: ${ethers.formatUnits(newAmount, 6)}`);
    } else {
        // New bid from this user/chain combination
        bids.push(bid);
        console.log(`[+] New Bid Recorded for ${intentId.slice(0, 10)}... on ${bid.sourceChain} - Bidder: ${bid.bidder.slice(0, 8)}... - Amount: ${ethers.formatUnits(bid.amount, 6)}`);
    }
}

export function getBids(intentId: string): any[] {
  return bidStore.get(intentId) || [];
}

export function getAllBids(): Map<string, any[]> {
  return bidStore;
}

export function addAuction(auctionId: string, auction: any) {
    auctionStore.set(auctionId, auction);
    console.log(`[+] New Auction Recorded: ${auctionId.slice(0, 10)}... on ${auction.sourceChain} - Reserve: ${ethers.formatUnits(auction.reservePrice, 6)}`);
}

export function getAuction(auctionId: string): any | undefined {
    return auctionStore.get(auctionId);
}

export function getAllAuctions(): Map<string, any> {
    return auctionStore;
}

function cleanupExistingListeners() {
    console.log(`   - Cleaning up ${activeContracts.length} existing event listeners...`);
    
    // Remove all listeners from existing contracts
    for (const contract of activeContracts) {
        try {
            contract.removeAllListeners();
        } catch (error) {
            console.warn(`   - Warning: Failed to remove listeners from contract:`, error);
        }
    }
    
    // Clear the active contracts array
    activeContracts = [];
}

export async function startEventListeners() {
    console.log("[*] Starting event listeners...");
    
    let totalListeners = 0;

    for (const chain of Object.values(CONFIG.chains)) {
        if (!chain.bidManagerAddress) {
            console.warn(`   - Skipping ${chain.name}: No bidManagerAddress configured`);
            continue;
        }

        try {
            const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
            
            // BidManager contract
            const bidManagerContract = new ethers.Contract(chain.bidManagerAddress, BID_MANAGER_ABI, provider);
            activeContracts.push(bidManagerContract);

            // Listen for new bid events (real-time)
            bidManagerContract.on("BidPlaced", (intentId, bidder, token, amount, event) => {
                // Debug: Log the event structure
                console.log(`🔍 DEBUG - Event structure on ${chain.name}:`, {
                    transactionHash: event.transactionHash,
                    logIndex: event.logIndex,
                    index: event.index,
                    blockNumber: event.blockNumber,
                    eventKeys: Object.keys(event)
                });
                
                // Create unique event identifier to prevent duplicates
                // Use a combination of txHash and blockNumber as fallback if logIndex is undefined
                const logId = event.logIndex !== undefined ? event.logIndex : 
                             event.index !== undefined ? event.index : 
                             event.blockNumber || Math.random();
                const eventId = `${event.transactionHash}-${logId}-bid`;
                
                console.log(`🎯 Created event ID: ${eventId}`);
                
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
                
                console.log(`🎉 NEW BID EVENT on ${chain.name}! Processing...`);
                addBid(intentId, bid);
            });
            
            totalListeners++;
            console.log(`   - ✅ Listening for bids on ${chain.name}`);

            // AuctionHub contract (if available)
            if (chain.auctionHubAddress) {
                const auctionHub = new ethers.Contract(chain.auctionHubAddress, AUCTION_HUB_ABI, provider);
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

        } catch (error) {
            console.error(`   - ❌ Failed to setup listeners for ${chain.name}:`, error);
        }
    }
    
    console.log(`[*] Event listeners initialized: ${totalListeners} listeners across ${Object.keys(CONFIG.chains).length} chains`);
}

export async function restartEventListeners() {
    console.log("[*] Restarting event listeners for fresh connections...");
    
    // Clean up existing listeners
    cleanupExistingListeners();
    
    // Start fresh listeners
    await startEventListeners();
    
    console.log("[✓] Event listeners restarted successfully");
}

// Cleanup function for graceful shutdown
export function cleanupEventListeners() {
    console.log("[*] Cleaning up all event listeners...");
    cleanupExistingListeners();
    console.log("[✓] All event listeners cleaned up");
}