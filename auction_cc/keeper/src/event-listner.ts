import {ethers} from "ethers";
import {CONFIG} from "./config";
import AUCTION_HUB_ABI from "../src/ABI/AUCTION_HUB_ABI.json";
import BID_MANAGER_ABI from "../src/ABI/BID_MANAGER_ABI.json";

const bidStore = new Map<string, any[]>();
const auctionStore = new Map<string, any>();



export function addBid(intentId: string, bid: any) {
    if (!bidStore.has(intentId)) {
        bidStore.set(intentId, []);
    }
    bidStore.get(intentId)!.push(bid);
    console.log(`[+] New Bid Recorded for ${intentId.slice(0, 10)}... on ${bid.sourceChain}`);
}

export function getBids(intentId: string): any[] {
  return bidStore.get(intentId) || [];
}

export function getAllBids(): Map<string, any[]> {
  return bidStore;
}

export function addAuction(auctionId: string, auction: any) {
    auctionStore.set(auctionId, auction);
    console.log(`[+] New Auction Recorded: ${auctionId.slice(0, 10)}...`);
}

export function getAuction(auctionId: string): any | undefined {
    return auctionStore.get(auctionId);
}

export function getAllAuctions(): Map<string, any> {
    return auctionStore;
}

export function startEventListeners(){
    console.log("[*] Starting event listeners...");

    for (const chain of Object.values(CONFIG.chains)) {
        if (!chain.bidManagerAddress) continue;

        const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
        const contract = new ethers.Contract(chain.bidManagerAddress, BID_MANAGER_ABI, provider);

        contract.on("BidPlaced", (intentId, bidder, token, amount, event) => {
            const bid = {
                intentId,
                bidder,
                amount,
                token,
                sourceChain: chain.name,
                transactionHash: event.transactionHash,
            };
            addBid(intentId, bid);
        });
        

        console.log(`   - Listening for bids on ${chain.name}`);

        if (chain.auctionHubAddress) {
            const auctionHub = new ethers.Contract(chain.auctionHubAddress, AUCTION_HUB_ABI, provider);

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
                };
                addAuction(intentId, auction);
            });

            console.log(`   - Listening for auctions on ${chain.name} AuctionHub`);
        }
    }
}

