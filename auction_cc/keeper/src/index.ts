import dotenv from 'dotenv';
dotenv.config();

console.log('🚀 Starting Auction Keeper with MongoDB...');
console.log('📁 Working directory:', process.cwd());
console.log('🔧 Node environment:', process.env.NODE_ENV || 'development');

import { startEventListeners, getAllAuctions, getAllBids, restartEventListeners } from './event-listner';
import { processEndedAuctions } from './auction-processor';
import { dbService } from './DB/db_service';
import { CONFIG } from './config';
import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Event listeners management
let eventListenerInterval: NodeJS.Timeout | null = null;
let auctionProcessingInterval: NodeJS.Timeout | null = null;

// Initialize database connection
async function initializeDatabase() {
    console.log('📊 Connecting to MongoDB...');
    try {
        await dbService.connect();
        console.log('✅ Database connection established');
    } catch (error) {
        console.error('❌ Failed to connect to database:', error);
        process.exit(1);
    }
}

// Initialize event listeners once and keep them alive
async function initializeEventMonitoring() {
    console.log('🔄 Initializing event monitoring...');
    
    // Start event listeners once - they will stay active
    await startEventListeners();
    
    console.log('✅ Event monitoring initialized - listeners will remain active');
}

// Initialize auction processing
function initializeAuctionProcessing() {
    console.log('⏰ Initializing auction processing...');
    
    // Process auctions every 10 seconds
    auctionProcessingInterval = setInterval(async () => {
        try {
            await processEndedAuctions();
        } catch (error) {
            console.error('❌ Error in periodic auction processing:', error);
        }
    }, CONFIG.processingInterval);
    
    console.log(`✅ Auction processing initialized with ${CONFIG.processingInterval}ms interval`);
}

// Health check endpoint
app.get('/health', async (req, res) => {
    const dbHealth = await dbService.healthCheck();
    
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        database: dbHealth,
        eventListening: !!eventListenerInterval,
        auctionProcessing: !!auctionProcessingInterval
    });
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await dbService.getStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics',
            details: errorMessage
        });
    }
});

// Get all auctions
app.get('/api/auctions', async (req, res) => {
    try {
        const allAuctions = await getAllAuctions();
        const auctionsArray = Array.from(allAuctions.entries()).map(([intentId, auction]) => ({
            intentId,
            seller: auction.seller,
            nftContract: auction.nftContract,
            tokenId: auction.tokenId?.toString() || auction.tokenId,
            startingPrice: auction.startingPrice?.toString() || auction.startingPrice,
            reservePrice: auction.reservePrice?.toString() || auction.reservePrice,
            deadline: auction.deadline?.toString() || auction.deadline,
            preferdToken: auction.preferdToken,
            preferdChain: auction.preferdChain?.toString() || auction.preferdChain,
            sourceChain: auction.sourceChain,
            status: auction.status,
            txHash: auction.txHash,
            timestamp: auction.timestamp
        }));
        
        res.json({
            success: true,
            count: auctionsArray.length,
            data: auctionsArray,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch auctions',
            details: errorMessage
        });
    }
});

// Get specific auction by intentId
app.get('/api/auctions/:intentId', async (req, res) => {
    try {
        const { intentId } = req.params;
        const allAuctions = await getAllAuctions();
        const auction = allAuctions.get(intentId);
        
        if (!auction) {
            return res.status(404).json({
                success: false,
                error: 'Auction not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                intentId,
                seller: auction.seller,
                nftContract: auction.nftContract,
                tokenId: auction.tokenId?.toString() || auction.tokenId,
                startingPrice: auction.startingPrice?.toString() || auction.startingPrice,
                reservePrice: auction.reservePrice?.toString() || auction.reservePrice,
                deadline: auction.deadline?.toString() || auction.deadline,
                preferdToken: auction.preferdToken,
                preferdChain: auction.preferdChain?.toString() || auction.preferdChain,
                sourceChain: auction.sourceChain,
                status: auction.status,
                txHash: auction.txHash,
                timestamp: auction.timestamp
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch auction',
            details: errorMessage
        });
    }
});

// Get all bids
app.get('/api/bids', async (req, res) => {
    try {
        const allBids = await getAllBids();
        const bidsArray = Array.from(allBids.entries()).map(([intentId, bids]) => ({
            intentId,
            bids: bids.map(bid => ({
                intentId: bid.intentId,
                bidder: bid.bidder,
                amount: bid.amount?.toString() || bid.amount,
                token: bid.token,
                sourceChain: bid.sourceChain,
                transactionHash: bid.transactionHash,
                timestamp: bid.timestamp
            }))
        }));
        
        res.json({
            success: true,
            count: bidsArray.length,
            data: bidsArray,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bids',
            details: errorMessage
        });
    }
});

// Get bids for specific auction
app.get('/api/bids/:intentId', async (req, res) => {
    try {
        const { intentId } = req.params;
        const allBids = await getAllBids();
        const bids = allBids.get(intentId) || [];
        
        const serializedBids = bids.map(bid => ({
            intentId: bid.intentId,
            bidder: bid.bidder,
            amount: bid.amount?.toString() || bid.amount,
            token: bid.token,
            sourceChain: bid.sourceChain,
            transactionHash: bid.transactionHash,
            timestamp: bid.timestamp
        }));
        
        res.json({
            success: true,
            intentId,
            count: serializedBids.length,
            data: serializedBids,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bids for auction',
            details: errorMessage
        });
    }
});

// Get keeper configuration (without sensitive data)
app.get('/api/config', (req, res) => {
    try {
        const safeConfig = {
            chains: Object.fromEntries(
                Object.entries(CONFIG.chains).map(([key, chain]) => [
                    key,
                    {
                        id: chain.id,
                        name: chain.name,
                        hasAuctionHub: !!chain.auctionHubAddress,
                        hasBidManager: !!chain.bidManagerAddress
                    }
                ])
            ),
            processingInterval: CONFIG.processingInterval,
            environment: process.env.NODE_ENV || 'development',
            eventRefreshInterval: 60000, // 1 minute
            lastUpdated: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: safeConfig
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch configuration',
            details: errorMessage
        });
    }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Graceful shutdown function
async function gracefulShutdown() {
    console.log('\n🛑 Shutting down keeper...');
    
    if (eventListenerInterval) {
        clearInterval(eventListenerInterval);
        console.log('✅ Event listener interval cleared');
    }
    
    if (auctionProcessingInterval) {
        clearInterval(auctionProcessingInterval);
        console.log('✅ Auction processing interval cleared');
    }
    
    // Disconnect from database
    try {
        await dbService.disconnect();
        console.log('✅ Database disconnected');
    } catch (error) {
        console.error('❌ Error disconnecting from database:', error);
    }
    
    process.exit(0);
}

// Initialize everything
async function initialize() {
    try {
        await initializeDatabase();
        await initializeEventMonitoring();
        initializeAuctionProcessing();
        console.log('🎉 Keeper fully initialized with MongoDB!');
    } catch (error) {
        console.error('❌ Failed to initialize keeper:', error);
        process.exit(1);
    }
}

// Start the initialization
initialize();

// Export the Express app for Vercel
export default app;

// For local development and production
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`🌐 Keeper API server running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 Statistics: http://localhost:${PORT}/api/stats`);
    console.log(`📋 Available API endpoints:`);
    console.log(`   GET  /health                 - Health check`);
    console.log(`   GET  /api/stats              - Database statistics`);
    console.log(`   GET  /api/auctions           - Get all auctions`);
    console.log(`   GET  /api/auctions/:id       - Get specific auction`);
    console.log(`   GET  /api/bids               - Get all bids`);
    console.log(`   GET  /api/bids/:id           - Get bids for auction`);
    console.log(`   GET  /api/config             - Get keeper configuration`);
    console.log(`🔄 Event listeners active`);
    console.log(`⏰ Auction processing every ${CONFIG.processingInterval}ms`);
    console.log(`📊 MongoDB integration enabled`);
});

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);