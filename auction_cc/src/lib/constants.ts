// Token addresses for different networks
export const TOKEN_ADDRESSES = {
  // TEST NETWORKS
  // Sepolia Testnet
  11155111: {
    USDT: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    DAI: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6'
  },
  // Polygon Mumbai Testnet
  80001: {
    USDT: '0xBD21A10F619BE90d6066c941b04e4B3304b9d19c',
    USDC: '0x742d35Cc6634C0532925a3b8D355Bd28442ecA8a',
    DAI: '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F'
  },
  // Arbitrum Sepolia Testnet
  421614: {
    USDT: '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E',
    USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    DAI: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73'
  },
  // Base Sepolia Testnet
  84532: {
    USDT: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    DAI: '0x7683022d84F726A96c4A6611CD31DBD5B91be7AA'
  }
};

export const SUPPORTED_TOKENS = ['USDT', 'USDC', 'DAI'] as const;
export type SupportedToken = typeof SUPPORTED_TOKENS[number];

export const CHAIN_NAMES = {
  // Test Networks
  11155111: 'Sepolia',
  80001: 'Polygon Mumbai',
  421614: 'Arbitrum Sepolia',
  84532: 'Base Sepolia'
} as const;

export const AUCTION_HUB_ADDRESS = '0xEF4910C0453EE856465521D39575Bc64c37A479b';