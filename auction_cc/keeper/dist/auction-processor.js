"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEndedAuctions = processEndedAuctions;
exports.initializeNexusSDK = initializeNexusSDK;
const ethers_1 = require("ethers");
const config_1 = require("./config");
const event_listner_1 = require("./event-listner");
const AUCTION_HUB_ABI_json_1 = __importDefault(require("../src/ABI/AUCTION_HUB_ABI.json"));
const BID_MANAGER_ABI_json_1 = __importDefault(require("../src/ABI/BID_MANAGER_ABI.json"));
// Nexus SDK instance - will be initialized dynamically
let _nexusSDK = null;
async function getNexusSDK() {
    if (_nexusSDK)
        return _nexusSDK;
    try {
        const { NexusSDK } = await Promise.resolve().then(() => __importStar(require('@avail-project/nexus-core')));
        _nexusSDK = new NexusSDK({ network: 'testnet' });
        // Initialize with provider created from keeper's private key
        // Use the first chain's RPC as the primary provider
        const primaryChain = Object.values(config_1.CONFIG.chains)[0];
        const provider = new ethers_1.ethers.JsonRpcProvider(primaryChain.rpcUrl);
        const keeperWallet = new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, provider);
        console.log(`[*] Initializing Nexus SDK with keeper wallet: ${keeperWallet.address}`);
        await _nexusSDK.initialize(keeperWallet);
        console.log(`[✓] Nexus SDK initialized successfully`);
        return _nexusSDK;
    }
    catch (error) {
        console.error('Failed to initialize Nexus SDK:', error);
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Nexus SDK initialization failed: ${message}`);
    }
}
// Uniswap SwapRouter02 addresses for different chains
const UNISWAP_SWAP_ROUTER02_ADDRESSES = {
    11155111: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E", // Ethereum Sepolia
    421614: "0x101F443B4d1b059569D643917553c771E1b9663E", // Arbitrum Sepolia
    84532: "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", // Base Sepolia
};
// SwapRouter02 ABI for exactInputSingle function
const SWAP_ROUTER02_ABI = [
    {
        inputs: [
            {
                components: [
                    { internalType: 'address', name: 'tokenIn', type: 'address' },
                    { internalType: 'address', name: 'tokenOut', type: 'address' },
                    { internalType: 'uint24', name: 'fee', type: 'uint24' },
                    { internalType: 'address', name: 'recipient', type: 'address' },
                    { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
                    { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' }
                ],
                internalType: 'struct IV3SwapRouter.ExactInputSingleParams',
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
function getSwapRouter02Address(chainId) {
    const routerAddress = UNISWAP_SWAP_ROUTER02_ADDRESSES[chainId];
    if (!routerAddress) {
        throw new Error(`Uniswap SwapRouter02 not available on chain ${chainId}`);
    }
    return routerAddress;
}
function getChainConfig(chainName) {
    return Object.values(config_1.CONFIG.chains).find(c => c.name === chainName);
}
const TOKEN_ADDRESS_TO_SYMBOL = {
    11155111: {
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': 'USDC',
        '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06': 'USDT',
    },
    421614: {
        '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d': 'USDC',
        '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E': 'USDT',
    },
    84532: {
        '0x036CbD53842c5426634e7929541eC2318f3dCF7e': 'USDC',
        '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9': 'USDT',
    },
    11155420: {
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': 'USDC',
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT',
    },
};
// Stable coin decimals mapping
const STABLE_COIN_DECIMALS = {
    'USDC': 6,
    'USDT': 6,
    'USDC.e': 6, // Bridged USDC on some chains
};
// Stable coins that can be considered equivalent (1:1 ratio)
const EQUIVALENT_STABLE_COINS = ['USDC', 'USDT', 'USDC.e'];
function getTokenSymbol(tokenAddress, chainId) {
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
function calculateStableCoinMinimumOut(amountIn, inputDecimals, outputDecimals, slippagePercent = 0.5) {
    // For stable coin swaps, we expect close to 1:1 ratio
    const amountInBigInt = typeof amountIn === 'string' ? BigInt(amountIn) : amountIn;
    // Adjust for decimal differences
    let adjustedAmount;
    if (inputDecimals === outputDecimals) {
        adjustedAmount = amountInBigInt;
    }
    else if (inputDecimals > outputDecimals) {
        // Input has more decimals, divide
        const decimalDiff = inputDecimals - outputDecimals;
        adjustedAmount = amountInBigInt / (10n ** BigInt(decimalDiff));
    }
    else {
        // Output has more decimals, multiply
        const decimalDiff = outputDecimals - inputDecimals;
        adjustedAmount = amountInBigInt * (10n ** BigInt(decimalDiff));
    }
    // Apply slippage (default 0.5% for stable coins)
    const slippageMultiplier = BigInt(Math.floor((100 - slippagePercent) * 100));
    const minimumOut = (adjustedAmount * slippageMultiplier) / 10000n;
    return minimumOut;
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
    console.log("\n[*] Processing ended auctions...");
    const allAuctions = (0, event_listner_1.getAllAuctions)();
    const currentTime = Math.floor(Date.now() / 1000);
    for (const [intentId, auctionData] of allAuctions.entries()) {
        try {
            const auctionChain = getChainConfig(auctionData.chain);
            if (!auctionChain) {
                console.error(`[-] Unknown chain: ${auctionData.chain}`);
                continue;
            }
            const provider = new ethers_1.ethers.JsonRpcProvider(auctionChain.rpcUrl);
            const auctionHub = new ethers_1.ethers.Contract(auctionChain.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, provider);
            const keeperWallet = new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, provider);
            const auction = await auctionHub.auctions(intentId);
            if (Number(auction.deadline) > currentTime || auction.status !== 0 /* Active */) {
                continue;
            }
            console.log(`[!] Auction ${intentId.slice(0, 10)}... on ${auctionData.chain} has ended. Processing...`);
            const bids = (0, event_listner_1.getBids)(intentId);
            if (bids.length === 0) {
                console.log("   - No bids found. Returning NFT to seller...");
                try {
                    const cancelTx = await auctionHub.connect(keeperWallet).cancelAuction(intentId);
                    await cancelTx.wait();
                    console.log(`   - NFT returned to seller. Tx: ${cancelTx.hash}`);
                }
                catch (error) {
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
                }
                catch (error) {
                    console.error("   - Failed to return NFT:", error);
                }
                continue;
            }
            console.log(`   - Winner: ${winner.bidder} with bid of ${formatStableCoinAmount(winner.amount, getTokenSymbol(winner.token, auctionChain.id))} ${getTokenSymbol(winner.token, auctionChain.id)}`);
            console.log("   - Finalizing auction and transferring NFT to winner...");
            try {
                const finalizeTx = await auctionHub.connect(keeperWallet).finalizeAuction(intentId);
                await finalizeTx.wait();
                console.log(`   - Auction finalized. NFT transferred to winner. Tx: ${finalizeTx.hash}`);
            }
            catch (error) {
                console.error("   - Failed to finalize auction:", error);
            }
            await settleCrossChainAuction(intentId, auction, winner, bids, auctionData.sourceChain);
            console.log(`   - Cross-chain settlement initiated for auction ${intentId.slice(0, 10)}...`);
        }
        catch (error) {
            console.error(`   - Error processing auction ${intentId.slice(0, 10)}...:`, error);
        }
    }
}
async function settleCrossChainAuction(intentId, auction, winner, allBids, sourceChain) {
    try {
        console.log(`   - Starting cross-chain settlement for auction ${intentId.slice(0, 10)}...`);
        const sourceChainConfig = getChainConfig(sourceChain);
        const targetChainConfig = getChainConfig(auction.preferdChain?.toString() || auction.preferdChain?.toString());
        if (!sourceChainConfig || !targetChainConfig) {
            throw new Error(`Chain configuration not found`);
        }
        // Get BidManager contract on winner's chain to release the winning bid
        const sourceProvider = new ethers_1.ethers.JsonRpcProvider(sourceChainConfig.rpcUrl);
        const bidManager = new ethers_1.ethers.Contract(sourceChainConfig.bidManagerAddress, BID_MANAGER_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, sourceProvider));
        // Release the winning bid from BidManager
        console.log(`   - Releasing winning bid from BidManager on ${sourceChain}...`);
        const releaseTx = await bidManager.releaseWinningBid(intentId, winner.bidder, auction.seller);
        await releaseTx.wait();
        console.log(`   - Winning bid released. Tx: ${releaseTx.hash}`);
        // Get initialized Nexus SDK
        const nexusSDK = await getNexusSDK();
        const winnerTokenAddress = winner.token;
        const requiredTokenAddress = auction.preferdToken || auction.preferdToken;
        const bidAmount = winner.amount;
        // Validate that we're working with stable coins as expected
        validateStableCoinOnlyAuction(winnerTokenAddress, requiredTokenAddress, sourceChainConfig.id, targetChainConfig.id);
        // Convert token addresses to symbols
        const winnerTokenSymbol = getTokenSymbol(winnerTokenAddress, sourceChainConfig.id);
        const requiredTokenSymbol = getTokenSymbol(requiredTokenAddress, targetChainConfig.id);
        console.log(`   - Winner token: ${winnerTokenSymbol} (${formatStableCoinAmount(bidAmount, winnerTokenSymbol)})`);
        console.log(`   - Required token: ${requiredTokenSymbol}`);
        // Check if tokens are the same or equivalent stable coins
        if (winnerTokenSymbol === requiredTokenSymbol) {
            console.log(`   - Tokens match exactly. Using simple bridge for ${formatStableCoinAmount(bidAmount, winnerTokenSymbol)} ${winnerTokenSymbol}...`);
            // Simple bridge transfer
            const bridgeResult = await nexusSDK.transfer({
                token: winnerTokenSymbol,
                amount: bidAmount.toString(),
                chainId: targetChainConfig.id,
                recipient: auction.seller,
                sourceChains: [sourceChainConfig.id],
            });
            console.log(`   - Bridge transaction successful: ${bridgeResult}`);
        }
        else if (areEquivalentStableCoins(winnerTokenSymbol, requiredTokenSymbol)) {
            console.log(`   - Tokens are equivalent stable coins (${winnerTokenSymbol} ≈ ${requiredTokenSymbol}). Using optimized stable coin swap via SwapRouter02...`);
            // For stable coin swaps, use the lowest fee tier (0.05%) for better rates
            const swapRouter02Address = getSwapRouter02Address(targetChainConfig.id);
            console.log(`   - Using Uniswap SwapRouter02 at ${swapRouter02Address} with 0.05% fee tier for stable coin pair`);
            // Calculate minimum amount out with 0.5% slippage for stable coins
            const winnerDecimals = getTokenDecimals(winnerTokenSymbol);
            const requiredDecimals = getTokenDecimals(requiredTokenSymbol);
            const amountOutMinimum = calculateStableCoinMinimumOut(bidAmount, winnerDecimals, requiredDecimals);
            const bridgeAndExecuteResult = await nexusSDK.bridgeAndExecute({
                token: winnerTokenSymbol,
                amount: bidAmount.toString(),
                toChainId: targetChainConfig.id,
                sourceChains: [sourceChainConfig.id],
                execute: {
                    contractAddress: swapRouter02Address,
                    contractAbi: SWAP_ROUTER02_ABI,
                    functionName: 'exactInputSingle',
                    buildFunctionParams: (token, amount, chainId, userAddress) => {
                        const swapParams = {
                            tokenIn: winnerTokenAddress,
                            tokenOut: requiredTokenAddress,
                            fee: 500, // 0.05% fee tier for stable coin pairs
                            recipient: auction.seller,
                            amountIn: amount,
                            amountOutMinimum: amountOutMinimum.toString(),
                            sqrtPriceLimitX96: 0 // No price limit for stable coins
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
            });
            console.log(`   - Stable coin bridge and swap transaction successful: ${bridgeAndExecuteResult}`);
        }
        else {
            // This case should not occur if we're only using stable coins, but keeping for safety
            console.warn(`   - Warning: Non-stable coin detected (${winnerTokenSymbol} -> ${requiredTokenSymbol}). This may result in high slippage and fees!`);
            console.log(`   - Using standard bridge + swap with higher fee tier via SwapRouter02...`);
            const swapRouter02Address = getSwapRouter02Address(targetChainConfig.id);
            const bridgeAndExecuteResult = await nexusSDK.bridgeAndExecute({
                token: winnerTokenSymbol,
                amount: bidAmount.toString(),
                toChainId: targetChainConfig.id,
                sourceChains: [sourceChainConfig.id],
                execute: {
                    contractAddress: swapRouter02Address,
                    contractAbi: SWAP_ROUTER02_ABI,
                    functionName: 'exactInputSingle',
                    buildFunctionParams: (token, amount, chainId, userAddress) => {
                        const swapParams = {
                            tokenIn: winnerTokenAddress,
                            tokenOut: requiredTokenAddress,
                            fee: 3000, // 0.3% fee tier for non-stable pairs
                            recipient: auction.seller,
                            amountIn: amount,
                            amountOutMinimum: 0, // Accept any amount for non-stable pairs (risky but necessary)
                            sqrtPriceLimitX96: 0
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
            });
            console.log(`   - Non-stable coin bridge and swap transaction successful: ${bridgeAndExecuteResult}`);
        }
        // Refund losing bidders
        console.log(`   - Refunding losing bidders...`);
        for (const bid of allBids) {
            if (bid.bidder !== winner.bidder) {
                try {
                    const bidChainConfig = getChainConfig(bid.sourceChain);
                    if (!bidChainConfig)
                        continue;
                    const bidProvider = new ethers_1.ethers.JsonRpcProvider(bidChainConfig.rpcUrl);
                    const bidManagerContract = new ethers_1.ethers.Contract(bidChainConfig.bidManagerAddress, BID_MANAGER_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, bidProvider));
                    const refundTx = await bidManagerContract.refundBid(intentId, bid.bidder);
                    await refundTx.wait();
                    console.log(`   - Refunded ${bid.bidder} on ${bid.sourceChain}. Tx: ${refundTx.hash}`);
                }
                catch (error) {
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
        const auctionProvider = new ethers_1.ethers.JsonRpcProvider(auctionChainConfig.rpcUrl);
        const auctionHub = new ethers_1.ethers.Contract(auctionChainConfig.auctionHubAddress, AUCTION_HUB_ABI_json_1.default, new ethers_1.ethers.Wallet(config_1.CONFIG.keeperPrivateKey, auctionProvider));
        const nftReleaseTx = await auctionHub.NFTrelease(intentId);
        await nftReleaseTx.wait();
        console.log(`   - NFT released to winner. Tx: ${nftReleaseTx.hash}`);
        console.log(`   - Cross-chain settlement completed successfully for auction ${intentId.slice(0, 10)}...`);
    }
    catch (error) {
        console.error(`   - Error in cross-chain settlement for auction ${intentId.slice(0, 10)}...:`, error);
        throw error;
    }
}
// Export function to pre-initialize Nexus SDK (optional)
async function initializeNexusSDK() {
    try {
        await getNexusSDK();
        console.log('[✓] Nexus SDK pre-initialized for keeper');
    }
    catch (error) {
        console.error('[✗] Failed to pre-initialize Nexus SDK:', error);
    }
}
