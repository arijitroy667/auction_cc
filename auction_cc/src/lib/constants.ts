// Token addresses for different networks
export const TOKEN_ADDRESSES = {
  // TEST NETWORKS
  // Sepolia Testnet
  11155111: {
    USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  },
  // Arbitrum Sepolia Testnet
  421614: {
    USDT: '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
    USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
  // Base Sepolia Testnet
  84532: {
    USDT: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  // Optimism Sepolia Testnet
  11155420: {
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    USDC: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
  }
};

export const SUPPORTED_TOKENS = ['USDT', 'USDC'] as const;
export type SupportedToken = typeof SUPPORTED_TOKENS[number];

export const CHAIN_NAMES = {
  // Test Networks
  11155111: 'Sepolia',
  421614: 'Arbitrum Sepolia',
  84532: 'Base Sepolia',
  11155420: 'Optimism Sepolia'
} as const;

export const AUCTION_HUB_ADDRESS = '0x7450193fd5cf58612F339CB26eA087e1dfd1B7aD';
export const BID_MANAGER_ADDRESS = '0x05524B97E7EBd95f66aaAd5585ba44b3ab9D7486';