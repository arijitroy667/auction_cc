import {ethers} from "ethers";
import {CONFIG} from "./config";
import { getAllAuctions,getBids } from "./event-listner";

function getChainConfig(chainName: string){
    return Object.values(CONFIG.chains).find(c => c.name === chainName);
}

export async function processEndedAuctions() {
    console.log("\n[*] Processing ended auctions...");

    const allAuctions = getAllAuctions();
    const currentTime = Math.floor(Date.now() / 1000);

    for (const [intentId, auctionData] of allAuctions.entries()) {
        try {
            const auctionChain = getChainConfig(auctionData.chain);
            if (!auctionChain){
                console.error(`[-] Unknown chain: ${auctionData.chain}`);
                continue;
            }
    
            const provider = new ethers.JsonRpcProvider(auctionChain.rpcUrl);
            const auctionHub = new ethers.Contract(
                auctionChain.auctionHubAddress,
                AUCTION_HUB_ABI,
                provider
            );
            const keeperWallet = new ethers.Wallet(CONFIG.keeperPrivateKey, provider);
    
            const auction = await auctionHub.auctions(intentId);
    
            if (Number(auction.deadline) > currentTime || auction.status !== 0 /* Active */) {
                continue;
            }
    
            console.log(`[!] Auction ${intentId.slice(0, 10)}... on ${auctionData.sourceChain} has ended. Processing...`);
    
            const bids = getBids(intentId);
            if (bids.length === 0) {
                console.log("   - No bids found. Returning NFT to seller...");
                // Return NFT to seller if no bids
                try {
                    const cancelTx = await auctionHub.connect(keeperWallet).cancelAuction(intentId);
                    await cancelTx.wait();
                    console.log(`   - NFT returned to seller. Tx: ${cancelTx.hash}`);
                } catch (error) {
                    console.error("   - Failed to return NFT:", error);
                }
                continue;
            }
    
            let winner = null;
            let highestBid = 0;
    
            for (const bid of bids) {
                if (Number(bid.amount) > highestBid) {
                    highestBid = Number(bid.amount);
                    winner = bid;
                }
            }
    
            if (!winner || highestBid < Number(auction.reservePrice)) {
                console.log("   - No valid bids met the reserve price. Returning NFT to seller...");
                try {
                    const cancelTx = await auctionHub.connect(keeperWallet).cancelAuction(intentId);
                    await cancelTx.wait();
                    console.log(`   - NFT returned to seller. Tx: ${cancelTx.hash}`);
                } catch (error) {
                    console.error("   - Failed to return NFT:", error);
                }
                continue;
            }
    
            console.log(`   - Winner: ${winner.bidder} with bid of ${ethers.formatEther(winner.amount)} ${winner.token}`);
    
            console.log("   - Finalizing auction and transferring NFT to winner...");
            try {
                const finalizeTx = await auctionHub.connect(keeperWallet).finalizeAuction(intentId);
                await finalizeTx.wait();
                console.log(`   - Auction finalized. NFT transferred to winner. Tx: ${finalizeTx.hash}`);
            } catch (error) {
                console.error("   - Failed to finalize auction:", error);
            }

            await settleCrossChainAuction( intentId, auction, winner, bids, auctionData.sourceChain);

            console.log(`   - Cross-chain settlement initiated for auction ${intentId.slice(0, 10)}...`);
        } catch (error) {
            console.error(`   - Error processing auction ${intentId.slice(0, 10)}...:`, error);
        }
    }
}

async function settleCrossChainAuction(intentId: string, auction: any, winner: any, allBids: any[], sourceChain: string) {
    
}