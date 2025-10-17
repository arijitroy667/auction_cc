import {ethers} from "ethers";
import {CONFIG} from "./config";
import AUCTION_HUB_ABI from "../src/ABI/AUCTION_HUB_ABI.json";
import BID_MANAGER_ABI from "../src/ABI/BID_MANAGER_ABI.json";

const bidStore = new Map<string, any[]>();
const auctionStore = new Map<string, any>();

// Store active contracts for cleanup
let activeContracts: ethers.Contract[] = [];

export function addBid(intentId: string, bid: any) {
    if (!bidStore.has(intentId)) {
        bidStore.set(intentId, []);
    }
    bidStore.get(intentId)!.push(bid);
    console.log(`[+] New Bid Recorded for ${intentId.slice(0, 10)}... on ${bid.sourceChain} - Amount: ${ethers.formatUnits(bid.amount, 6)} ${bid.token.slice(0, 8)}...`);
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

export function startEventListeners() {
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

            bidManagerContract.on("BidPlaced", (intentId, bidder, token, amount, event) => {
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
                const auctionHub = new ethers.Contract(chain.auctionHubAddress, AUCTION_HUB_ABI, provider);
                activeContracts.push(auctionHub);

                auctionHub.on("AuctionCreated", (intentId, seller, nftContract, tokenId, startingPrice, reservePrice, deadline, preferdToken, preferdChain, event) => {
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

export function restartEventListeners() {
    console.log("[*] Restarting event listeners for fresh connections...");
    
    // Clean up existing listeners
    cleanupExistingListeners();
    
    // Start fresh listeners
    startEventListeners();
    
    console.log("[✓] Event listeners restarted successfully");
}

// Cleanup function for graceful shutdown
export function cleanupEventListeners() {
    console.log("[*] Cleaning up all event listeners...");
    cleanupExistingListeners();
    console.log("[✓] All event listeners cleaned up");
}