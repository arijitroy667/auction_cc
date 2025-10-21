import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

export const CONFIG = {
  keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY!,
  chains: {
    ethereum: {
      id: 11155111,
      name: "ethereum",
      rpcUrl: process.env.SEPOLIA_RPC_URL!,
      auctionHubAddress: "0x7450193fd5cf58612F339CB26eA087e1dfd1B7aD",
      bidManagerAddress: "0x05524B97E7EBd95f66aaAd5585ba44b3ab9D7486",
    },
    arbitrumSepolia: {
      id: 421614,
      name: "arbitrumSepolia",
      rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL!,
      auctionHubAddress: "0x7450193fd5cf58612F339CB26eA087e1dfd1B7aD",
      bidManagerAddress: "0x05524B97E7EBd95f66aaAd5585ba44b3ab9D7486",
    },
    base: {
      id: 84532,
      name: "base",
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
      auctionHubAddress: "0x7450193fd5cf58612F339CB26eA087e1dfd1B7aD",
      bidManagerAddress: "0x05524B97E7EBd95f66aaAd5585ba44b3ab9D7486",
    },
    optimism:{
      id: 11155420,
      name: "optimism",
      rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL!,
      auctionHubAddress: "0x7450193fd5cf58612F339CB26eA087e1dfd1B7aD",
      bidManagerAddress: "0x05524B97E7EBd95f66aaAd5585ba44b3ab9D7486",
    }
  },
  // Process auctions every 2 minutes
  processingInterval: parseInt(process.env.PROCESSING_INTERVAL || '10000'), // 10 s default
};

console.log('✅ Configuration loaded successfully');
console.log('📊 Processing interval:', CONFIG.processingInterval + 'ms (' + (CONFIG.processingInterval/1000) + 's)');
console.log('🔗 Chains configured:', Object.keys(CONFIG.chains).length);
console.log('⏰ Optimized for short auctions (2min minimum)');
console.log('-------------------------------------------------------------');
