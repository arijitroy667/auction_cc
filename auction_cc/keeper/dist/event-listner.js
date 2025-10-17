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
const ethers_1 = require("ethers");
const config_1 = require("./config");
const AUCTION_HUB_ABI_json_1 = __importDefault(require("../src/ABI/AUCTION_HUB_ABI.json"));
const BID_MANAGER_ABI_json_1 = __importDefault(require("../src/ABI/BID_MANAGER_ABI.json"));
const bidStore = new Map();
const auctionStore = new Map();
function addBid(intentId, bid) {
    if (!bidStore.has(intentId)) {
        bidStore.set(intentId, []);
    }
    bidStore.get(intentId).push(bid);
    console.log(`[+] New Bid Recorded for ${intentId.slice(0, 10)}... on ${bid.sourceChain}`);
}
function getBids(intentId) {
    return bidStore.get(intentId) || [];
}
function getAllBids() {
    return bidStore;
}
function addAuction(auctionId, auction) {
    auctionStore.set(auctionId, auction);
    console.log(`[+] New Auction Recorded: ${auctionId.slice(0, 10)}...`);
}
function getAuction(auctionId) {
    return auctionStore.get(auctionId);
}
function getAllAuctions() {
    return auctionStore;
}
function startEventListeners() {
    console.log("[*] Starting event listeners...");
    for (const chain of Object.values(config_1.CONFIG.chains)) {
        if (!chain.bidManagerAddress)
            continue;
        const provider = new ethers_1.ethers.JsonRpcProvider(chain.rpcUrl);
        const contract = new ethers_1.ethers.Contract(chain.bidManagerAddress, BID_MANAGER_ABI_json_1.default, provider);
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
            const auctionHub = new ethers_1.ethers.Contract(chain.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, provider);
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
