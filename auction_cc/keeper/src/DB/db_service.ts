import mongoose from 'mongoose';
import Auction, { IAuction } from './model/auction_model';
import Bid, { IBid } from './model/bid_model';

class DatabaseService {
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        console.log('📊 Database already connected');
        return;
      }

      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/auction_keeper';
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        bufferCommands: false
      });

      this.isConnected = true;
      console.log('📊 Connected to MongoDB successfully');
      console.log(`📍 Database: ${mongoose.connection.db?.databaseName}`);
      console.log(`🌐 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await mongoose.disconnect();
        this.isConnected = false;
        console.log('📊 Disconnected from MongoDB');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  // Auction Methods
  async addAuction(auctionData: any): Promise<IAuction> {
    try {
      const auction = new Auction({
        intentId: auctionData.intentId,
        seller: auctionData.seller,
        nftContract: auctionData.nftContract,
        tokenId: auctionData.tokenId.toString(),
        startingPrice: auctionData.startingPrice.toString(),
        reservePrice: auctionData.reservePrice.toString(),
        deadline: auctionData.deadline.toString(),
        preferdToken: auctionData.preferdToken,
        preferdChain: auctionData.preferdChain.toString(),
        sourceChain: auctionData.sourceChain,
        status: auctionData.status || 0,
        txHash: auctionData.txHash,
        timestamp: auctionData.timestamp
      });

      const savedAuction = await auction.save();
      console.log(`[+] 💾 Auction saved to DB: ${savedAuction.intentId.slice(0, 10)}... on ${savedAuction.sourceChain}`);
      return savedAuction;
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate key error - auction already exists
        console.log(`[+] 📝 Auction ${auctionData.intentId.slice(0, 10)}... already exists in DB`);
        const existingAuction = await Auction.findOne({ intentId: auctionData.intentId });
        if (existingAuction) {
          return existingAuction;
        }
      }
      console.error('❌ Error saving auction to DB:', error);
      throw error;
    }
  }

  async updateAuctionStatus(intentId: string, status: number, additionalData?: any): Promise<IAuction | null> {
    try {
      const updateData: any = { status };
      
      if (additionalData) {
        if (additionalData.cancelTxHash) updateData.cancelTxHash = additionalData.cancelTxHash;
        if (additionalData.cancelTimestamp) updateData.cancelTimestamp = additionalData.cancelTimestamp;
      }

      const updatedAuction = await Auction.findOneAndUpdate(
        { intentId },
        updateData,
        { new: true }
      );

      if (updatedAuction) {
        console.log(`[+] 📝 Auction status updated: ${intentId.slice(0, 10)}... → status: ${status}`);
      }

      return updatedAuction;
    } catch (error) {
      console.error('❌ Error updating auction status:', error);
      throw error;
    }
  }

  async getAuction(intentId: string): Promise<IAuction | null> {
    try {
      return await Auction.findOne({ intentId });
    } catch (error) {
      console.error('❌ Error fetching auction:', error);
      throw error;
    }
  }

  async getAllAuctions(): Promise<IAuction[]> {
    try {
      return await Auction.find({}).sort({ createdAt: -1 });
    } catch (error) {
      console.error('❌ Error fetching all auctions:', error);
      throw error;
    }
  }

  async getActiveAuctions(): Promise<IAuction[]> {
    try {
      return await Auction.find({ 
        status: { $in: [0, 1] } // Active or Finalized but not yet settled
      }).sort({ deadline: 1 });
    } catch (error) {
      console.error('❌ Error fetching active auctions:', error);
      throw error;
    }
  }

  // Bid Methods
    async addBid(bidData: any): Promise<IBid> {
    try {
      // ✅ IMPROVED: Better fallback transaction ID generation
      let txHash = bidData.transactionHash;
      
      if (!txHash || txHash === 'unknown') {
        // Generate a more unique fallback ID
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        const bidderShort = bidData.bidder.slice(-8); // Last 8 chars of bidder address
        txHash = `gen-${bidderShort}-${timestamp}-${random}`;
        
        console.log(`[!] 🔄 Generated fallback transaction ID for bid: ${txHash}`);
        console.log(`[!]    - Intent: ${bidData.intentId.slice(0, 10)}...`);
        console.log(`[!]    - Bidder: ${bidData.bidder.slice(0, 8)}...`);
        console.log(`[!]    - Amount: ${bidData.amount}`);
        console.log(`[!]    - Original txHash: ${bidData.transactionHash}`);
      }

      const bid = new Bid({
        intentId: bidData.intentId,
        bidder: bidData.bidder,
        amount: bidData.amount.toString(),
        token: bidData.token,
        sourceChain: bidData.sourceChain,
        transactionHash: txHash,
        timestamp: bidData.timestamp
      });

      const savedBid = await bid.save();
      
      const txDisplay = savedBid.transactionHash.startsWith('gen-') 
        ? `${savedBid.transactionHash} (generated)`
        : savedBid.transactionHash.slice(0, 10) + '...';
        
      console.log(`[+] 💾 New bid saved to DB: ${savedBid.intentId.slice(0, 10)}... - ${savedBid.bidder.slice(0, 8)}... - Amount: ${savedBid.amount} (tx: ${txDisplay})`);
      return savedBid;
    } catch (error: any) {
      if (error.code === 11000) {
        // Duplicate transaction hash - bid already processed
        const txDisplay = String(bidData.transactionHash || 'generated').startsWith('gen-') 
          ? `${bidData.transactionHash} (generated)`
          : String(bidData.transactionHash || 'generated').slice(0, 10) + '...';
          
        console.log(`[+] 📝 Bid transaction ${txDisplay} already processed`);
        
        // Try to find the existing bid
        const existingBid = await Bid.findOne({ 
          $or: [
            { transactionHash: bidData.transactionHash },
            { 
              intentId: bidData.intentId,
              bidder: bidData.bidder,
              amount: bidData.amount.toString(),
              token: bidData.token
            }
          ]
        });
        
        if (existingBid) {
          return existingBid;
        }
      }
      console.error('❌ Error saving bid to DB:', error);
      throw error;
    }
  }

  async getBids(intentId: string): Promise<IBid[]> {
    try {
      // ✅ Return all bids for this intent - let the processor aggregate them
      return await Bid.find({ intentId }).sort({ timestamp: 1 });
    } catch (error) {
      console.error('❌ Error fetching bids:', error);
      throw error;
    }
  }

  // ✅ NEW: Add method to get aggregated bids by bidder for an intent
  async getAggregatedBids(intentId: string): Promise<{ bidder: string; totalAmount: string; token: string; sourceChain: string; bidCount: number; transactions: string[] }[]> {
    try {
      const bids = await Bid.find({ intentId }).sort({ timestamp: 1 });
      
      // Group bids by bidder address (case-insensitive)
      const bidderMap = new Map<string, { 
        bidder: string; 
        totalAmount: bigint; 
        token: string; 
        sourceChain: string; 
        bidCount: number;
        transactions: string[];
      }>();
      
      for (const bid of bids) {
        const bidderKey = bid.bidder.toLowerCase();
        const bidAmount = BigInt(bid.amount);
        
        if (bidderMap.has(bidderKey)) {
          const existing = bidderMap.get(bidderKey)!;
          existing.totalAmount += bidAmount;
          existing.bidCount += 1;
          existing.transactions.push(bid.transactionHash);
        } else {
          bidderMap.set(bidderKey, {
            bidder: bid.bidder, // Keep original case
            totalAmount: bidAmount,
            token: bid.token,
            sourceChain: bid.sourceChain,
            bidCount: 1,
            transactions: [bid.transactionHash]
          });
        }
      }
      
      // Convert to array format
      return Array.from(bidderMap.values()).map(aggregated => ({
        bidder: aggregated.bidder,
        totalAmount: aggregated.totalAmount.toString(),
        token: aggregated.token,
        sourceChain: aggregated.sourceChain,
        bidCount: aggregated.bidCount,
        transactions: aggregated.transactions
      }));
    } catch (error) {
      console.error('❌ Error fetching aggregated bids:', error);
      throw error;
    }
  }

  async getAllBids(): Promise<{ intentId: string; bids: IBid[] }[]> {
    try {
      const bids = await Bid.find({}).sort({ timestamp: -1 });
      
      // Group bids by intentId
      const bidMap = new Map<string, IBid[]>();
      bids.forEach(bid => {
        if (!bidMap.has(bid.intentId)) {
          bidMap.set(bid.intentId, []);
        }
        bidMap.get(bid.intentId)!.push(bid);
      });

      return Array.from(bidMap.entries()).map(([intentId, bids]) => ({
        intentId,
        bids
      }));
    } catch (error) {
      console.error('❌ Error fetching all bids:', error);
      throw error;
    }
  }

  async getBidsByBidder(bidder: string): Promise<IBid[]> {
    try {
      return await Bid.find({ bidder }).sort({ timestamp: -1 });
    } catch (error) {
      console.error('❌ Error fetching bidder bids:', error);
      throw error;
    }
  }

  // Health check method
  async healthCheck(): Promise<{ connected: boolean; dbName?: string; collections?: number }> {
    try {
      if (!this.isConnected) {
        return { connected: false };
      }

      const admin = mongoose.connection.db?.admin();
      const collections = await mongoose.connection.db?.listCollections().toArray();
      
      return {
        connected: true,
        dbName: mongoose.connection.db?.databaseName,
        collections: collections?.length || 0
      };
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return { connected: false };
    }
  }

  // Get statistics
  async getStats(): Promise<any> {
    try {
      const auctionCount = await Auction.countDocuments();
      const bidCount = await Bid.countDocuments();
      const activeAuctionCount = await Auction.countDocuments({ status: { $in: [0, 1] } });
      const settledAuctionCount = await Auction.countDocuments({ status: 2 });
      const cancelledAuctionCount = await Auction.countDocuments({ status: 3 });

      return {
        auctions: {
          total: auctionCount,
          active: activeAuctionCount,
          settled: settledAuctionCount,
          cancelled: cancelledAuctionCount
        },
        bids: {
          total: bidCount
        },
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      throw error;
    }
  }
}

export const dbService = new DatabaseService();