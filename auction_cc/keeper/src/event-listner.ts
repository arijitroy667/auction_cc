import { ethers } from "ethers";
import { CONFIG } from "./config";
import { dbService } from "./DB/db_service";
import AUCTION_HUB_ABI from "../src/ABI/AUCTION_HUB_ABI.json";
import BID_MANAGER_ABI from "../src/ABI/BID_MANAGER_ABI.json";

function debugEventStructure(event: any, eventType: string = 'unknown') {
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

// Store active contracts for cleanup
let activeContracts: ethers.Contract[] = [];

// Track processed events to prevent duplicates
const processedEvents = new Set<string>();

export async function addBid(intentId: string, bid: any) {
    try {
        await dbService.addBid(bid);
    } catch (error) {
        console.error('❌ Failed to add bid to database:', error);
        throw error;
    }
}

export async function getBids(intentId: string): Promise<any[]> {
    try {
        const bids = await dbService.getBids(intentId);
        return bids.map(bid => ({
            intentId: bid.intentId,
            bidder: bid.bidder,
            amount: bid.amount,
            token: bid.token,
            sourceChain: bid.sourceChain,
            transactionHash: bid.transactionHash,
            timestamp: bid.timestamp
        }));
    } catch (error) {
        console.error('❌ Failed to get bids from database:', error);
        return [];
    }
}

export async function getAllBids(): Promise<Map<string, any[]>> {
    try {
        const allBids = await dbService.getAllBids();
        const bidMap = new Map<string, any[]>();
        
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
    } catch (error) {
        console.error('❌ Failed to get all bids from database:', error);
        return new Map();
    }
}

export async function addAuction(auctionId: string, auction: any) {
    try {
        await dbService.addAuction(auction);
    } catch (error) {
        console.error('❌ Failed to add auction to database:', error);
        throw error;
    }
}

export async function getAuction(auctionId: string): Promise<any | undefined> {
    try {
        const auction = await dbService.getAuction(auctionId);
        if (!auction) return undefined;
        
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
    } catch (error) {
        console.error('❌ Failed to get auction from database:', error);
        return undefined;
    }
}

export async function getAllAuctions(): Promise<Map<string, any>> {
    try {
        const auctions = await dbService.getAllAuctions();
        const auctionMap = new Map<string, any>();
        
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
    } catch (error) {
        console.error('❌ Failed to get all auctions from database:', error);
        return new Map();
    }
}

export async function updateAuctionStatus(intentId: string, status: number, additionalData?: any) {
    try {
        await dbService.updateAuctionStatus(intentId, status, additionalData);
    } catch (error) {
        console.error('❌ Failed to update auction status in database:', error);
        throw error;
    }
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

            // ✅ FIXED: Always process bid events, don't skip due to missing tx hash
            bidManagerContract.on("BidPlaced", async (intentId, bidder, token, amount, event) => {
                try {
                    // Try multiple approaches to get transaction hash
                    let txHash = null;
                    
                    // Method 1: From event.log
                    if (event.log?.transactionHash) {
                        txHash = event.log.transactionHash;
                    }
                    // Method 2: Direct from event
                    else if (event.transactionHash) {
                        txHash = event.transactionHash;
                    }
                    // Method 3: From event.receipt if available
                    else if (event.receipt?.transactionHash) {
                        txHash = event.receipt.transactionHash;
                    }
                    // Method 4: Try to get transaction hash from provider
                    else if (event.blockNumber && event.transactionIndex !== undefined) {
                        try {
                            const block = await provider.getBlock(event.blockNumber);
                            if (block && block.transactions[event.transactionIndex]) {
                                txHash = block.transactions[event.transactionIndex];
                            }
                        } catch (error) {
                            console.warn('   - Could not fetch transaction from block:', error);
                        }
                    }
                    
                    // ✅ CHANGED: Don't skip - log warning but continue processing
                    if (!txHash) {
                        console.warn(`⚠️  Could not extract transaction hash from bid event - will generate fallback ID`);
                        debugEventStructure(event, 'BidPlaced'); // Add this line for debugging
                        console.warn(`   - Event keys:`, Object.keys(event));
                        console.warn(`   - Will proceed with bid processing using generated transaction ID`);
                        txHash = 'unknown'; // Let db_service.addBid() handle the fallback generation
                    }
                    
                    const blockNumber = event.log?.blockNumber || event.blockNumber || 0;
                    const logIndex = event.log?.logIndex !== undefined ? event.log.logIndex : 
                                    event.logIndex !== undefined ? event.logIndex : Math.random();
                    
                    // ✅ Use timestamp + random for event ID when txHash is unknown
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
                        transactionHash: txHash, // Can be 'unknown' - db service will handle it
                        timestamp: new Date().toISOString()
                    };
                    
                    console.log(`🎉 NEW BID EVENT on ${chain.name}! Processing...`);
                    console.log(`   - Intent ID: ${intentId}`);
                    console.log(`   - Bidder: ${bidder}`);
                    console.log(`   - Amount: ${amount.toString()}`);
                    console.log(`   - Token: ${token}`);
                    console.log(`   - TX Hash: ${txHash}`);
                    
                    await addBid(intentId, bid);
                } catch (error) {
                    console.error('❌ Error processing bid event:', error);
                }
            });
            
            totalListeners++;
            console.log(`   - ✅ Listening for bids on ${chain.name}`);

            // AuctionHub contract (if available)
            if (chain.auctionHubAddress) {
                const auctionHub = new ethers.Contract(chain.auctionHubAddress, AUCTION_HUB_ABI, provider);
                activeContracts.push(auctionHub);

                // ✅ FIXED: Listen for new auction events with proper transaction hash handling
                auctionHub.on("AuctionCreated", async (intentId, seller, nftContract, tokenId, startingPrice, reservePrice, deadline, preferdToken, preferdChain, event) => {
                    try {
                        // Get transaction hash from the event log
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
                        
                        // Validate that txHash is not undefined or 'unknown'
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
                            status: 0, // Active
                            txHash: txHash, // ✅ Ensure txHash is properly set
                            timestamp: new Date().toISOString()
                        };
                        
                        await addAuction(intentId, auction);
                    } catch (error) {
                        console.error('❌ Error processing auction event:', error);
                    }
                });

                // ✅ FIXED: Listen for auction cancelled events with proper transaction hash handling
                auctionHub.on("AuctionCancelled", async (intentId, event) => {
                    try {
                        // Get transaction hash from the event log
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
                    } catch (error) {
                        console.error('❌ Error processing auction cancelled event:', error);
                    }
                });
                
                totalListeners += 2;
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