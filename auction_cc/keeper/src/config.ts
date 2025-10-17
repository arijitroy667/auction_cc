import "dotenv/config";

export const CONFIG = {
  keeperPrivateKey: process.env.KEEPER_PRIVATE_KEY!,
  chains: {
    ethereum: {
      id: 1,
      name: "ethereum",
      rpcUrl: process.env.ETHEREUM_RPC_URL!,
      auctionHubAddress: "0x09690941A1Bef2822DC5814a49aFAb14168aC0B2",
      bidManagerAddress: "0xc1d848E9892dDB0264719c9bd1628d663575e387", // Added this
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
    // Add other chains here
  },
  // Interval in milliseconds to check for ended auctions
  processingInterval: 60000, 
};

if (!CONFIG.keeperPrivateKey) {
  throw new Error("KEEPER_PRIVATE_KEY is not set in the environment variables.");
}