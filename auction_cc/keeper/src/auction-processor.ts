import { TransferParams, 
    TransferResult,
    BridgeAndExecuteParams, 
    BridgeAndExecuteResult,
    ExecuteParams,
    ExecuteResult,
    NexusSDK } from '@avail-project/nexus-core';
import {ethers} from "ethers";
import {CONFIG} from "./config";
import { getAllAuctions,getBids } from "./event-listner";
import AUCTION_HUB_ABI from "../src/ABI/AUCTION_HUB_ABI.json";
import BID_MANAGER_ABI from "../src/ABI/BID_MANAGER_ABI.json";

// Initialize Nexus SDK
const nexusSDK = new NexusSDK({ network: 'testnet' });

// Uniswap V3 SwapRouter interface (simplified)
const UNISWAP_V3_SWAP_ABI = [
    {
        inputs: [
            {
                components: [
                    { internalType: 'address', name: 'tokenIn', type: 'address' },
                    { internalType: 'address', name: 'tokenOut', type: 'address' },
                    { internalType: 'uint24', name: 'fee', type: 'uint24' },
                    { internalType: 'address', name: 'recipient', type: 'address' },
                    { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
                    { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' }
                ],
                internalType: 'struct ExactInputSingleParams',
                name: 'params',
                type: 'tuple'
            }
        ],
        name: 'exactInputSingle',
        outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function'
    }
];

// Uniswap V3 SwapRouter addresses for different chains
const UNISWAP_V3_ROUTER_ADDRESSES: { [chainId: number]: string } = {
    1: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Ethereum Mainnet
    11155111: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // Ethereum Sepolia
    137: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Polygon Mainnet
    80002: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // Polygon Amoy
    42161: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Arbitrum One
    421614: "0x101F443B4d1b059569D643917553c771E1b9663E", // Arbitrum Sepolia
    8453: "0x2626664c2603336E57B271c5C0b26F421741e481", // Base Mainnet
    84532: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", // Base Sepolia
    11155420: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", // Optimism Sepolia
};

function getUniswapV3RouterAddress(chainId: number): string {
    const routerAddress = UNISWAP_V3_ROUTER_ADDRESSES[chainId];
    if (!routerAddress) {
        throw new Error(`Uniswap V3 Router not available on chain ${chainId}`);
    }
    return routerAddress;
}

function getChainConfig(chainName: string){
    return Object.values(CONFIG.chains).find(c => c.name === chainName);
}

const TOKEN_ADDRESS_TO_SYMBOL: { [chainId: number]: { [address: string]: string } } = {
    11155111: { // Ethereum
        '0xA0b86a33E6441838308c3494c43E543c96C52Fd7': 'USDC',
        '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
    },
    80002: { // Polygon
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': 'USDC',
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT',
    },
    421614: { // Arbitrum
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': 'USDC',
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT',
    },
    84532: { // Base
        '0xA0b86a33E6441838308c3494c43E543c96C52Fd7': 'USDC',
        '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
    },
    11155120: { // Optimism
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': 'USDC',
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT',
    },
    
};

function getTokenSymbol(tokenAddress: string, chainId: number): string {
    const chainTokens = TOKEN_ADDRESS_TO_SYMBOL[chainId];
    if (!chainTokens) {
        throw new Error(`Token mapping not found for chain ${chainId}`);
    }
    
    const symbol = chainTokens[tokenAddress.toLowerCase()];
    if (!symbol) {
        throw new Error(`Token symbol not found for address ${tokenAddress} on chain ${chainId}`);
    }
    
    return symbol;
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
    try {
        console.log(`   - Starting cross-chain settlement for auction ${intentId.slice(0, 10)}...`);
        
        const sourceChainConfig = getChainConfig(sourceChain);
        const targetChainConfig = getChainConfig(auction.preferdChain.toString());
        
        if (!sourceChainConfig || !targetChainConfig) {
            throw new Error(`Chain configuration not found`);
        }

        // Get BidManager contract on winner's chain to release the winning bid
        const sourceProvider = new ethers.JsonRpcProvider(sourceChainConfig.rpcUrl);
        const bidManager = new ethers.Contract(
            sourceChainConfig.bidManagerAddress,
            BID_MANAGER_ABI,
            new ethers.Wallet(CONFIG.keeperPrivateKey, sourceProvider)
        );

        // Release the winning bid from BidManager
        console.log(`   - Releasing winning bid from BidManager on ${sourceChain}...`);
        const releaseTx = await bidManager.releaseWinningBid(intentId, winner.bidder);
        await releaseTx.wait();
        console.log(`   - Winning bid released. Tx: ${releaseTx.hash}`);

        // Initialize Nexus SDK if not already initialized
        if (!nexusSDK.isInitialized()) {
            const keeperProvider = new ethers.Wallet(CONFIG.keeperPrivateKey, sourceProvider).provider;
            await nexusSDK.initialize(keeperProvider);
        }

        const winnerTokenAddress = winner.token;
        const requiredTokenAddress = auction.preferdToken;
        const bidAmount = winner.amount;

        // Convert token addresses to symbols
        const winnerTokenSymbol = getTokenSymbol(winnerTokenAddress, sourceChainConfig.id);
        const requiredTokenSymbol = getTokenSymbol(requiredTokenAddress, targetChainConfig.id);

        // Check if tokens are the same (no swap needed)
        if (winnerTokenSymbol === requiredTokenSymbol) {
            console.log(`   - Tokens match. Using simple bridge for ${ethers.formatEther(bidAmount)} tokens...`);
            
            // Simple bridge transfer
            const bridgeResult: TransferResult = await nexusSDK.transfer({
                token: winnerTokenSymbol,
                amount: bidAmount.toString(),
                chainId: targetChainConfig.id,
                recipient: auction.seller,
                sourceChains: [sourceChainConfig.id],
            }as TransferParams);

            console.log(`   - Bridge transaction successful: ${bridgeResult}`);
        } else {
            console.log(`   - Tokens differ. Using bridge + swap via Uniswap V3...`);
            console.log(`   - Bridging ${ethers.formatEther(bidAmount)} ${winnerTokenAddress} and swapping to ${requiredTokenAddress}`);
            
            // Get the correct Uniswap V3 Router address for the target chain
            const uniswapRouterAddress = getUniswapV3RouterAddress(targetChainConfig.id);
            console.log(`   - Using Uniswap V3 Router at ${uniswapRouterAddress} on chain ${targetChainConfig.id}`);
            
            // Use bridge and execute with proper Nexus SDK format
            const bridgeAndExecuteResult: BridgeAndExecuteResult = await nexusSDK.bridgeAndExecute({
                token: winnerTokenSymbol,
                amount: bidAmount.toString(),
                toChainId: targetChainConfig.id,
                sourceChains: [sourceChainConfig.id],
                execute: {
                    contractAddress: uniswapRouterAddress,
                    contractAbi: UNISWAP_V3_SWAP_ABI,
                    functionName: 'exactInputSingle',
                    buildFunctionParams: (
                        token: any,
                        amount: string,
                        chainId: number,
                        userAddress: `0x${string}`,
                    ) => {
                        const swapParams = {
                            tokenIn: winnerTokenAddress,
                            tokenOut: requiredTokenAddress,
                            fee: 3000, // 0.3% fee tier
                            recipient: auction.seller,
                            deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
                            amountIn: amount,
                            amountOutMinimum: 0, // Accept any amount of tokens out (in production, calculate proper minimum)
                            sqrtPriceLimitX96: 0 // No price limit
                        };
                        
                        return {
                            functionParams: [swapParams],
                        };
                    },
                    tokenApproval: {
                        token: winnerTokenSymbol,
                        amount: bidAmount.toString(),
                    },
                },
                waitForReceipt: true,
            } as BridgeAndExecuteParams);

            console.log(`   - Bridge and execute transaction successful: ${bridgeAndExecuteResult}`);
        }

        // Refund losing bidders
        console.log(`   - Refunding losing bidders...`);
        for (const bid of allBids) {
            if (bid.bidder !== winner.bidder) {
                try {
                    const bidChainConfig = getChainConfig(bid.sourceChain);
                    if (!bidChainConfig) continue;

                    const bidProvider = new ethers.JsonRpcProvider(bidChainConfig.rpcUrl);
                    const bidManagerContract = new ethers.Contract(
                        bidChainConfig.bidManagerAddress,
                        BID_MANAGER_ABI,
                        new ethers.Wallet(CONFIG.keeperPrivateKey, bidProvider)
                    );

                    const refundTx = await bidManagerContract.refundBid(intentId, bid.bidder);
                    await refundTx.wait();
                    console.log(`   - Refunded ${bid.bidder} on ${bid.sourceChain}. Tx: ${refundTx.hash}`);
                } catch (error) {
                    console.error(`   - Failed to refund bidder ${bid.bidder}:`, error);
                }
            }
        }

        // Finally, release the NFT to the winner
        console.log(`   - Releasing NFT to winner...`);
        const auctionChainConfig = getChainConfig(auction.sourceChain);
        if (!auctionChainConfig) {
            throw new Error(`Auction chain configuration not found for sourceChain: ${auction.sourceChain}`);
        }
        const auctionProvider = new ethers.JsonRpcProvider(auctionChainConfig.rpcUrl);
        const auctionHub = new ethers.Contract(
            auctionChainConfig.auctionHubAddress,
            AUCTION_HUB_ABI,
            new ethers.Wallet(CONFIG.keeperPrivateKey, auctionProvider)
        );

        const nftReleaseTx = await auctionHub.NFTrelease(intentId);
        await nftReleaseTx.wait();
        console.log(`   - NFT released to winner. Tx: ${nftReleaseTx.hash}`);

        console.log(`   - Cross-chain settlement completed successfully for auction ${intentId.slice(0, 10)}...`);

    } catch (error) {
        console.error(`   - Error in cross-chain settlement for auction ${intentId.slice(0, 10)}...:`, error);
        throw error;
    }
}