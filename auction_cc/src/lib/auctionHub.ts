import { ethers } from 'ethers';
import AuctionHubABI from '@/abis/AuctionHub.json';
import { AUCTION_HUB_ADDRESS, TOKEN_ADDRESSES, type SupportedToken } from '@/lib/constants';

export interface CreateAuctionParams {
  nftContract: string;
  tokenId: string;
  startingPrice: string;
  reservePrice?: string;
  deadline: number;
  preferdToken: SupportedToken;
  preferdChain: number;
}

export class AuctionHubContract {
  private contract: ethers.Contract;
  private signer: ethers.Signer;

  constructor(signer: ethers.Signer) {
    this.signer = signer;
    this.contract = new ethers.Contract(AUCTION_HUB_ADDRESS, AuctionHubABI, signer);
  }

  /**
   * Creates a new auction
   */
  async createAuction(params: CreateAuctionParams): Promise<string> {
    const {
      nftContract,
      tokenId,
      startingPrice,
      reservePrice,
      deadline,
      preferdToken,
      preferdChain
    } = params;

    // Get token address for the preferred chain
    const tokenAddress = TOKEN_ADDRESSES[preferdChain as keyof typeof TOKEN_ADDRESSES]?.[preferdToken];
    if (!tokenAddress) {
      throw new Error(`Token ${preferdToken} not supported on chain ${preferdChain}`);
    }

    // Convert prices to token units (6 decimals for USDC/USDT)
    // Using 6 decimals to match the standard for stablecoins
    const startingPriceWei = ethers.parseUnits(startingPrice, 6);
    const reservePriceWei = reservePrice ? ethers.parseUnits(reservePrice, 6) : startingPriceWei;

    try {
      const tx = await this.contract.createAuction(
        nftContract,
        tokenId,
        startingPriceWei,
        reservePriceWei,
        deadline,
        tokenAddress,
        preferdChain
      );

      const receipt = await tx.wait();
      
      // Extract the intentId from transaction events
      for (const log of receipt.logs) {
        try {
          const parsedLog = this.contract.interface.parseLog({ topics: log.topics, data: log.data });
          if (parsedLog?.name === 'AuctionCreated') {
            return parsedLog.args[0]; // intentId
          }
        } catch {
          // Skip logs that can't be parsed
          continue;
        }
      }
      
      return tx.hash;
    } catch (error) {
      console.error('Error creating auction:', error);
      throw error;
    }
  }

  /**
   * Gets auction details by intent ID
   */
  async getAuction(intentId: string) {
    try {
      return await this.contract.getAuction(intentId);
    } catch (error) {
      console.error('Error fetching auction:', error);
      throw error;
    }
  }

  /**
   * Gets all auctions for a seller
   */
  async getSellerAuctions(seller: string) {
    try {
      return await this.contract.getSellerAuctions(seller);
    } catch (error) {
      console.error('Error fetching seller auctions:', error);
      throw error;
    }
  }

  /**
   * Cancels an auction
   */
  async cancelAuction(intentId: string): Promise<ethers.ContractTransactionReceipt> {
    try {
      console.log("📤 Calling cancelAuction with intentId:", intentId);
      
      const tx = await this.contract.cancelAuction(intentId);
      console.log("📤 Transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✅ Transaction confirmed:", receipt.hash);
      
      return receipt;
    } catch (error) {
      console.error('Error cancelling auction:', error);
      throw error;
    }
  }

  /**
   * Gets all intent IDs
   */
  async getAllIntentIds() {
    try {
      return await this.contract.getAllIntentIds();
    } catch (error) {
      console.error('Error fetching all intent IDs:', error);
      throw error;
    }
  }
}

/**
 * Helper function to get contract instance
 */
export function getAuctionHubContract(signer: ethers.Signer): AuctionHubContract {
  return new AuctionHubContract(signer);
}