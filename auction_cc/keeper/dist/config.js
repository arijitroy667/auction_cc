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
    'SEPOLIA_RPC_URL',
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
            rpcUrl: process.env.SEPOLIA_RPC_URL,
            auctionHubAddress: "0x5acC198CC747E0e12571E7BDFFfb7Cd7ab1f82aA",
            bidManagerAddress: "0x9042E8cFe2C44f1ab71009aD4e055632B11f9f8d",
        },
        arbitrumSepolia: {
            id: 421614,
            name: "arbitrumSepolia",
            rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL,
            auctionHubAddress: "0x5acC198CC747E0e12571E7BDFFfb7Cd7ab1f82aA",
            bidManagerAddress: "0x9042E8cFe2C44f1ab71009aD4e055632B11f9f8d",
        },
        base: {
            id: 84532,
            name: "base",
            rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
            auctionHubAddress: "0x5acC198CC747E0e12571E7BDFFfb7Cd7ab1f82aA",
            bidManagerAddress: "0x9042E8cFe2C44f1ab71009aD4e055632B11f9f8d",
        },
        optimism: {
            id: 11155420,
            name: "optimism",
            rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL,
            auctionHubAddress: "0x5acC198CC747E0e12571E7BDFFfb7Cd7ab1f82aA",
            bidManagerAddress: "0x9042E8cFe2C44f1ab71009aD4e055632B11f9f8d",
        }
    },
    // Process auctions every 2 minutes
    processingInterval: parseInt(process.env.PROCESSING_INTERVAL || '10000'), // 10 s default
};
console.log('✅ Configuration loaded successfully');
console.log('📊 Processing interval:', exports.CONFIG.processingInterval + 'ms (' + (exports.CONFIG.processingInterval / 1000) + 's)');
console.log('🔗 Chains configured:', Object.keys(exports.CONFIG.chains).length);
console.log('⏰ Optimized for short auctions (2min minimum)');
console.log('-------------------------------------------------------------');
