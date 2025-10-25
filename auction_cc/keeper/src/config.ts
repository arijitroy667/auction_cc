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
      auctionHubAddress: "0x5b2a21c9F09E3C1516ADd9a54ba8F0062d82b94b",
      bidManagerAddress: "0xE1E58945A3b5b4AA6A6E5E648d22Feb87FB88BDF",
    },
    arbitrumSepolia: {
      id: 421614,
      name: "arbitrumSepolia",
      rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL!,
      auctionHubAddress: "0x5b2a21c9F09E3C1516ADd9a54ba8F0062d82b94b",
      bidManagerAddress: "0xE1E58945A3b5b4AA6A6E5E648d22Feb87FB88BDF",
    },
    base: {
      id: 84532,
      name: "base",
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
      auctionHubAddress: "0x5b2a21c9F09E3C1516ADd9a54ba8F0062d82b94b",
      bidManagerAddress: "0xE1E58945A3b5b4AA6A6E5E648d22Feb87FB88BDF",
    },
    optimism:{
      id: 11155420,
      name: "optimism",
      rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC_URL!,
      auctionHubAddress: "0x5b2a21c9F09E3C1516ADd9a54ba8F0062d82b94b",
      bidManagerAddress: "0xE1E58945A3b5b4AA6A6E5E648d22Feb87FB88BDF",
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
