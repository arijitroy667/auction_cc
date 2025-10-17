"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
console.log('Loading configuration...');
// Check if required environment variables are set
const requiredEnvVars = [
    'KEEPER_PRIVATE_KEY',
    'ETHEREUM_RPC_URL',
    'ARBITRUM_SEPOLIA_RPC_URL',
    'BASE_SEPOLIA_RPC_URL',
    'OPTIMISM_SEPOLIA_RPC_URL'
];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('Please check your .env file in the keeper directory');
    process.exit(1);
}
exports.CONFIG = {
    keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY,
    chains: {
        ethereum: {
            id: 11155111,
            name: "ethereum",
            rpcUrl: process.env.ETHEREUM_RPC_URL,
            auctionHubAddress: "0x003b0C383aFF1C5a08073fB8e5e704818313Ee95",
            bidManagerAddress: "0x8CDcA61d24949ecE0402e38b0F3F55929F697342",
        },
        arbitrumSepolia: {
            id: 421614,
            name: "arbitrumSepolia",
            rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL,
            auctionHubAddress: "0x003b0C383aFF1C5a08073fB8e5e704818313Ee95",
            bidManagerAddress: "0x8CDcA61d24949ecE0402e38b0F3F55929F697342",
        },
        base: {
            id: 84532,
            name: "base",
            rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
            auctionHubAddress: "0x003b0C383aFF1C5a08073fB8e5e704818313Ee95",
            bidManagerAddress: "0x8CDcA61d24949ecE0402e38b0F3F55929F697342",
        },
        optimism: {
            id: 11155420,
            name: "optimism",
            rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL,
            auctionHubAddress: "0x003b0C383aFF1C5a08073fB8e5e704818313Ee95",
            bidManagerAddress: "0x8CDcA61d24949ecE0402e38b0F3F55929F697342",
        }
    },
    // Process auctions every 2 minutes
    processingInterval: parseInt(process.env.PROCESSING_INTERVAL || '120000'), // 2 minutes default
};
console.log('✅ Configuration loaded successfully');
console.log('📊 Processing interval:', exports.CONFIG.processingInterval + 'ms');
console.log('🔗 Chains configured:', Object.keys(exports.CONFIG.chains).length);
console.log('🎧 Event listeners will remain active continuously');
console.log('-------------------------------------------------------------');
