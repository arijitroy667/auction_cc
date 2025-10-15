import "dotenv/config";

export const CONFIG = {
  keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY!,
  chains: {
    ethereum: {
      id: 1,
      name: "ethereum",
      rpcUrl: process.env.ETHEREUM_RPC_URL!,
      auctionHubAddress: "0xYourAuctionHubAddressOnEthereum",
      bidManagerAddress: "0xYourBidManagerAddressOnEthereum", // Added this
    },
    polygon: {
      id: 137,
      name: "polygon",
      rpcUrl: process.env.POLYGON_RPC_URL!,
      auctionHubAddress: "0xYourAuctionHubAddressOnPolygon",
      bidManagerAddress: "0xYourBidManagerAddressOnPolygon",
    },
    arbitrum: {
      id: 42161,
      name: "arbitrum",
      rpcUrl: process.env.ARBITRUM_RPC_URL!,
      auctionHubAddress: "0xYourAuctionHubAddressOnArbitrum",
      bidManagerAddress: "0xYourBidManagerAddressOnArbitrum",
    },
    base: {
      id: 8453,
      name: "base",
      rpcUrl: process.env.BASE_RPC_URL!,
        auctionHubAddress: "0xYourAuctionHubAddressOnBase",
      bidManagerAddress: "0xYourBidManagerAddressOnBase",
    },
    // Add other chains here
  },
  // Interval in milliseconds to check for ended auctions
  processingInterval: 60000, 
};

if (!CONFIG.keeperPrivateKey) {
  throw new Error("KEEPER_PRIVATE_KEY is not set in the environment variables.");
}