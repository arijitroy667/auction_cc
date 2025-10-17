import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Loading configuration...');

// Check if required environment variables are set
const requiredEnvVars = [
  'KEEPER_PRIVATE_KEY',
  'ETHEREUM_RPC_URL',
  'POLYGON_RPC_URL',
  'ARBITRUM_RPC_URL',
  'BASE_RPC_URL',
  'OPTIMISM_RPC_URL'
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
      rpcUrl: process.env.ETHEREUM_RPC_URL!,
      auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
      bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
    },
    polygon: {
      id: 137,
      name: "polygon",
      rpcUrl: process.env.POLYGON_RPC_URL!,
      auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
      bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
    },
    arbitrum: {
      id: 42161,
      name: "arbitrum",
      rpcUrl: process.env.ARBITRUM_RPC_URL!,
      auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
      bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
    },
    base: {
      id: 8453,
      name: "base",
      rpcUrl: process.env.BASE_RPC_URL!,
      auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
      bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
    },
    optimism:{
      id: 11155420,
      name: "optimism",
      rpcUrl: process.env.OPTIMISM_RPC_URL!,
      auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
      bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387",
    }
  },
  // Process auctions every 2 minutes (event listeners refresh every 1 minute)
  processingInterval: parseInt(process.env.PROCESSING_INTERVAL || '120000'), // 2 minutes default
};

console.log('✅ Configuration loaded successfully');
console.log('📊 Processing interval:', CONFIG.processingInterval + 'ms');
console.log('🔗 Chains configured:', Object.keys(CONFIG.chains).length);
console.log('🔄 Event listeners will refresh every 60 seconds');
console.log('-------------------------------------------------------------');