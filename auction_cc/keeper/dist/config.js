"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTokenSymbolByAddress = exports.isSupportedChain = exports.isSupportedToken = exports.getTokenAddress = exports.CONFIG = void 0;
require("dotenv/config");
exports.CONFIG = {
    keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY,
    chains: {
        sepolia: {
            id: 11155111,
            name: "sepolia",
            rpcUrl: process.env.SEPOLIA_RPC_URL,
            auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
            bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
        },
        polygonMumbai: {
            id: 80001,
            name: "polygonMumbai",
            rpcUrl: process.env.POLYGON_MUMBAI_RPC_URL,
            auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
            bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
        },
        arbitrumSepolia: {
            id: 421614,
            name: "arbitrumSepolia",
            rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL,
            auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
            bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
        },
        baseSepolia: {
            id: 84532,
            name: "baseSepolia",
            rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
            auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
            bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
        },
    },
    // Supported tokens configuration
    supportedTokens: ['USDT', 'USDC', 'DAI'],
    // Token addresses for testnet chains
    tokenAddresses: {
        11155111: {
            USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
            USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
            DAI: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6'
        },
        80001: {
            USDT: '0xBD21A10F619BE90d6066c941b04e4B3304b9d19c',
            USDC: '0x742d35Cc6634C0532925a3b8D355Bd28442ecA8a',
            DAI: '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F'
        },
        421614: {
            USDT: '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
            USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
            DAI: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73'
        },
        84532: {
            USDT: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
            USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            DAI: '0x7683022d84F726A96c4A6611CD31DBD5B91be7AA'
        }
    },
    // Interval in milliseconds to check for ended auctions
    processingInterval: 60000,
};
// Utility functions for token handling
const getTokenAddress = (chainId, token) => {
    const chainTokens = exports.CONFIG.tokenAddresses[chainId];
    if (!chainTokens) {
        throw new Error(`Chain ${chainId} is not supported`);
    }
    const tokenAddress = chainTokens[token];
    if (!tokenAddress) {
        throw new Error(`Token ${token} is not supported on chain ${chainId}`);
    }
    return tokenAddress;
};
exports.getTokenAddress = getTokenAddress;
const isSupportedToken = (token) => {
    return exports.CONFIG.supportedTokens.includes(token);
};
exports.isSupportedToken = isSupportedToken;
const isSupportedChain = (chainId) => {
    return Object.values(exports.CONFIG.chains).some(chain => chain.id === chainId);
};
exports.isSupportedChain = isSupportedChain;
const getTokenSymbolByAddress = (chainId, address) => {
    const chainTokens = exports.CONFIG.tokenAddresses[chainId];
    if (!chainTokens)
        return null;
    for (const [symbol, tokenAddress] of Object.entries(chainTokens)) {
        if (tokenAddress.toLowerCase() === address.toLowerCase()) {
            return symbol;
        }
    }
    return null;
};
exports.getTokenSymbolByAddress = getTokenSymbolByAddress;
if (!exports.CONFIG.keeperPrivateKey) {
    throw new Error("KEEPER_PRIVATE_KEY is not set in the environment variables.");
}
