"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const auction_model_1 = __importDefault(require("./model/auction_model"));
const bid_model_1 = __importDefault(require("./model/bid_model"));
class DatabaseService {
    constructor() {
        this.isConnected = false;
    }
    async connect() {
        try {
            if (this.isConnected) {
                console.log('📊 Database already connected');
                return;
            }
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/auction_keeper';
            await mongoose_1.default.connect(mongoUri, {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                maxPoolSize: 10,
                minPoolSize: 2,
                maxIdleTimeMS: 30000,
                bufferCommands: false
            });
            this.isConnected = true;
            console.log('📊 Connected to MongoDB successfully');
            console.log(`📍 Database: ${mongoose_1.default.connection.db?.databaseName}`);
            console.log(`🌐 Host: ${mongoose_1.default.connection.host}:${mongoose_1.default.connection.port}`);
            mongoose_1.default.connection.on('error', (error) => {
                console.error('❌ MongoDB connection error:', error);
            });
            mongoose_1.default.connection.on('disconnected', () => {
                console.warn('⚠️  MongoDB disconnected');
                this.isConnected = false;
            });
            mongoose_1.default.connection.on('reconnected', () => {
                console.log('🔄 MongoDB reconnected');
                this.isConnected = true;
            });
        }
        catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error);
            this.isConnected = false;
            throw error;
        }
    }
    async disconnect() {
        try {
            if (this.isConnected) {
                await mongoose_1.default.disconnect();
                this.isConnected = false;
                console.log('📊 Disconnected from MongoDB');
            }
        }
        catch (error) {
            console.error('❌ Error disconnecting from MongoDB:', error);
            throw error;
        }
    }
    async addAuction(auctionData) {
        try {
            const auction = new auction_model_1.default({
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
        }
        catch (error) {
            if (error.code === 11000) {
                console.log(`[+] 📝 Auction ${auctionData.intentId.slice(0, 10)}... already exists in DB`);
                const existingAuction = await auction_model_1.default.findOne({ intentId: auctionData.intentId });
                if (existingAuction) {
                    return existingAuction;
                }
            }
            console.error('❌ Error saving auction to DB:', error);
            throw error;
        }
    }
    async updateAuctionStatus(intentId, status, additionalData) {
        try {
            const updateData = { status };
            if (additionalData) {
                if (additionalData.cancelTxHash)
                    updateData.cancelTxHash = additionalData.cancelTxHash;
                if (additionalData.cancelTimestamp)
                    updateData.cancelTimestamp = additionalData.cancelTimestamp;
            }
            const updatedAuction = await auction_model_1.default.findOneAndUpdate({ intentId }, updateData, { new: true });
            if (updatedAuction) {
                console.log(`[+] 📝 Auction status updated: ${intentId.slice(0, 10)}... → status: ${status}`);
            }
            return updatedAuction;
        }
        catch (error) {
            console.error('❌ Error updating auction status:', error);
            throw error;
        }
    }
    async getAuction(intentId) {
        try {
            return await auction_model_1.default.findOne({ intentId });
        }
        catch (error) {
            console.error('❌ Error fetching auction:', error);
            throw error;
        }
    }
    async getAllAuctions() {
        try {
            return await auction_model_1.default.find({}).sort({ createdAt: -1 });
        }
        catch (error) {
            console.error('❌ Error fetching all auctions:', error);
            throw error;
        }
    }
    async getActiveAuctions() {
        try {
            return await auction_model_1.default.find({
                status: { $in: [0, 1] }
            }).sort({ deadline: 1 });
        }
        catch (error) {
            console.error('❌ Error fetching active auctions:', error);
            throw error;
        }
    }
    async addBid(bidData) {
        try {
            let txHash = bidData.transactionHash;
            if (!txHash || txHash === 'unknown') {
                const timestamp = Date.now();
                const random = Math.floor(Math.random() * 1000000);
                const bidderShort = bidData.bidder.slice(-8);
                txHash = `gen-${bidderShort}-${timestamp}-${random}`;
                console.log(`[!] 🔄 Generated fallback transaction ID for bid: ${txHash}`);
                console.log(`[!]    - Intent: ${bidData.intentId.slice(0, 10)}...`);
                console.log(`[!]    - Bidder: ${bidData.bidder.slice(0, 8)}...`);
                console.log(`[!]    - Amount: ${bidData.amount}`);
                console.log(`[!]    - Original txHash: ${bidData.transactionHash}`);
            }
            const bid = new bid_model_1.default({
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
        }
        catch (error) {
            if (error.code === 11000) {
                const txDisplay = String(bidData.transactionHash || 'generated').startsWith('gen-')
                    ? `${bidData.transactionHash} (generated)`
                    : String(bidData.transactionHash || 'generated').slice(0, 10) + '...';
                console.log(`[+] 📝 Bid transaction ${txDisplay} already processed`);
                const existingBid = await bid_model_1.default.findOne({
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
    async getBids(intentId) {
        try {
            return await bid_model_1.default.find({ intentId }).sort({ timestamp: 1 });
        }
        catch (error) {
            console.error('❌ Error fetching bids:', error);
            throw error;
        }
    }
    async getAggregatedBids(intentId) {
        try {
            const bids = await bid_model_1.default.find({ intentId }).sort({ timestamp: 1 });
            const bidderMap = new Map();
            for (const bid of bids) {
                const bidderKey = bid.bidder.toLowerCase();
                const bidAmount = BigInt(bid.amount);
                if (bidderMap.has(bidderKey)) {
                    const existing = bidderMap.get(bidderKey);
                    existing.totalAmount += bidAmount;
                    existing.bidCount += 1;
                    existing.transactions.push(bid.transactionHash);
                }
                else {
                    bidderMap.set(bidderKey, {
                        bidder: bid.bidder,
                        totalAmount: bidAmount,
                        token: bid.token,
                        sourceChain: bid.sourceChain,
                        bidCount: 1,
                        transactions: [bid.transactionHash]
                    });
                }
            }
            return Array.from(bidderMap.values()).map(aggregated => ({
                bidder: aggregated.bidder,
                totalAmount: aggregated.totalAmount.toString(),
                token: aggregated.token,
                sourceChain: aggregated.sourceChain,
                bidCount: aggregated.bidCount,
                transactions: aggregated.transactions
            }));
        }
        catch (error) {
            console.error('❌ Error fetching aggregated bids:', error);
            throw error;
        }
    }
    async getAllBids() {
        try {
            const bids = await bid_model_1.default.find({}).sort({ timestamp: -1 });
            const bidMap = new Map();
            bids.forEach(bid => {
                if (!bidMap.has(bid.intentId)) {
                    bidMap.set(bid.intentId, []);
                }
                bidMap.get(bid.intentId).push(bid);
            });
            return Array.from(bidMap.entries()).map(([intentId, bids]) => ({
                intentId,
                bids
            }));
        }
        catch (error) {
            console.error('❌ Error fetching all bids:', error);
            throw error;
        }
    }
    async getBidsByBidder(bidder) {
        try {
            return await bid_model_1.default.find({ bidder }).sort({ timestamp: -1 });
        }
        catch (error) {
            console.error('❌ Error fetching bidder bids:', error);
            throw error;
        }
    }
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { connected: false };
            }
            const admin = mongoose_1.default.connection.db?.admin();
            const collections = await mongoose_1.default.connection.db?.listCollections().toArray();
            return {
                connected: true,
                dbName: mongoose_1.default.connection.db?.databaseName,
                collections: collections?.length || 0
            };
        }
        catch (error) {
            console.error('❌ Database health check failed:', error);
            return { connected: false };
        }
    }
    async getStats() {
        try {
            const auctionCount = await auction_model_1.default.countDocuments();
            const bidCount = await bid_model_1.default.countDocuments();
            const activeAuctionCount = await auction_model_1.default.countDocuments({ status: { $in: [0, 1] } });
            const settledAuctionCount = await auction_model_1.default.countDocuments({ status: 2 });
            const cancelledAuctionCount = await auction_model_1.default.countDocuments({ status: 3 });
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
        }
        catch (error) {
            console.error('❌ Error fetching stats:', error);
            throw error;
        }
    }
}
exports.dbService = new DatabaseService();
