// Token addresses for different networks
export const TOKEN_ADDRESSES = {
  // TEST NETWORKS
  // Sepolia Testnet
  11155111: {
    USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
    USDC: '0xf08A50178dfcDe18524640EA6618a1f965821715',
  },
  // Arbitrum Sepolia Testnet
  421614: {
    USDT: '0xb9a4873d8d2C22e56b8574e8605644d08E047434',
    USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  },
  // Base Sepolia Testnet
  84532: {
    USDT: '0xf7e53b20f39a5f8c35005fEf37eef03A7b0d0B5a',
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
  // Optimism Sepolia Testnet
  11155420: {
    USDT: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
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