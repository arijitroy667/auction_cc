import dotenv from 'dotenv';
dotenv.config();

console.log('🚀 Starting Auction Keeper on Render...');
console.log('📁 Working directory:', process.cwd());
console.log('🔧 Node environment:', process.env.NODE_ENV || 'development');
console.log('🌐 Platform: Render');

import { startEventListeners, getAllAuctions, getAllBids, getBids } from './event-listner';
import { processEndedAuctions } from './auction-processor';
import { dbService } from './DB/db_service';
import { CONFIG } from './config';
import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// State tracking
let dbConnected = false;
let eventListenersActive = false;
let auctionProcessingInterval: NodeJS.Timeout | null = null;

// Initialize database connection
async function initializeDatabase() {
    console.log('📊 Connecting to MongoDB...');
    try {
        await dbService.connect();
        dbConnected = true;
        console.log('✅ Database connection established');
        
        // Test database connectivity
        const health = await dbService.healthCheck();
        console.log('🔍 Database health check:', health);
    } catch (error) {
        console.error('❌ Failed to connect to database:', error);
        throw error;
    }
}

// Initialize event listeners
async function initializeEventMonitoring() {
    console.log('🔄 Initializing blockchain event monitoring...');
    
    try {
        await startEventListeners();
        eventListenersActive = true;
        console.log('✅ Event monitoring initialized - listeners are now active');
        console.log('📡 Monitoring for auction and bid events across all configured chains');
    } catch (error) {
        console.error('❌ Failed to start event listeners:', error);
        throw error;
    }
}

// Initialize auction processing
function initializeAuctionProcessing() {
    console.log('⏰ Initializing periodic auction processing...');
    
    // Process auctions every interval
    auctionProcessingInterval = setInterval(async () => {
        try {
            console.log(`[*] 📊 Processing ended auctions... (${new Date().toLocaleTimeString()}) - ${CONFIG.processingInterval/1000}s interval`);
            await processEndedAuctions();
        } catch (error) {
            console.error('❌ Error in periodic auction processing:', error);
        }
    }, CONFIG.processingInterval);
    
    console.log(`✅ Auction processing initialized with ${CONFIG.processingInterval}ms (${CONFIG.processingInterval/1000}s) interval`);
}

// Root endpoint with full service info
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Auction Keeper Service - Full Event Monitoring Active',
        version: '1.0.0',
        platform: 'Render',
        mode: 'full-keeper',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        status: {
            database: dbConnected,
            eventListeners: eventListenersActive,
            auctionProcessing: !!auctionProcessingInterval
        },
        endpoints: {
            health: '/health',
            stats: '/api/stats',
            auctions: '/api/auctions',
            'auction-detail': '/api/auctions/:intentId',
            bids: '/api/bids',
            'bid-detail': '/api/bids/:intentId',
            config: '/api/config'
        },
        features: [
            'Real-time blockchain event listening',
            'Automatic auction processing',
            'Cross-chain bid aggregation',
            'MongoDB data persistence',
            'RESTful API endpoints'
        ]
    });
});

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealth = dbConnected ? await dbService.healthCheck() : { connected: false };
        
        const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(process.uptime()),
            platform: 'Render',
            environment: process.env.NODE_ENV || 'development',
            database: dbHealth,
            services: {
                eventListeners: eventListenersActive,
                auctionProcessing: !!auctionProcessingInterval,
                apiServer: true
            },
            chains: Object.keys(CONFIG.chains),
            processingInterval: `${CONFIG.processingInterval}ms`,
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                unit: 'MB'
            }
        };
        
        // Determine overall health
        const isHealthy = dbConnected && eventListenersActive && !!auctionProcessingInterval;
        
        res.status(isHealthy ? 200 : 503).json(healthStatus);
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            platform: 'Render'
        });
    }
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
    try {
        if (!dbConnected) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            });
        }
        
        const stats = await dbService.getStats();
        const systemStats = {
            uptime: Math.floor(process.uptime()),
            memory: process.memoryUsage(),
            platform: 'Render',
            nodeVersion: process.version,
            eventListeners: eventListenersActive,
            auctionProcessing: !!auctionProcessingInterval
        };
        
        res.json({
            success: true,
            data: {
                database: stats,
                system: systemStats
            },
            timestamp: new Date().toISOString()
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
        if (!dbConnected) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            });
        }
        
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
            timestamp: new Date().toISOString(),
            platform: 'Render'
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
        if (!dbConnected) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            });
        }
        
        const { intentId } = req.params;
        const allAuctions = await getAllAuctions();
        const auction = allAuctions.get(intentId);
        
        if (!auction) {
            return res.status(404).json({
                success: false,
                error: 'Auction not found',
                intentId
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
        if (!dbConnected) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            });
        }
        
        const allBids = await getAllBids();
        const bidsArray = Array.from(allBids.entries()).map(([intentId, bids]) => ({
            intentId,
            bidCount: bids.length,
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
            totalBids: bidsArray.reduce((sum, auction) => sum + auction.bidCount, 0),
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
        if (!dbConnected) {
            return res.status(503).json({
                success: false,
                error: 'Database not connected'
            });
        }
        
        const { intentId } = req.params;
        const bids = await getBids(intentId);
        
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

// Get keeper configuration
app.get('/api/config', (req, res) => {
    try {
        const safeConfig = {
            platform: 'Render',
            mode: 'full-keeper',
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
            features: {
                eventListeners: eventListenersActive,
                auctionProcessing: !!auctionProcessingInterval,
                crossChainSupport: true,
                realTimeUpdates: true
            },
            uptime: Math.floor(process.uptime()),
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
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
        platform: 'Render'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        platform: 'Render',
        availableEndpoints: [
            'GET /',
            'GET /health',
            'GET /api/stats',
            'GET /api/auctions',
            'GET /api/auctions/:intentId',
            'GET /api/bids',
            'GET /api/bids/:intentId',
            'GET /api/config'
        ]
    });
});

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
    console.log(`\n🛑 Received ${signal}. Shutting down keeper gracefully...`);
    
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
    
    console.log('🏁 Shutdown complete');
    process.exit(0);
}

// Initialize everything
async function initialize() {
    try {
        console.log('🔄 Starting initialization sequence...');
        
        await initializeDatabase();
        await initializeEventMonitoring();
        initializeAuctionProcessing();
        
        console.log('🎉 Keeper fully initialized and running on Render!');
        console.log('📊 Real-time blockchain monitoring active');
        console.log('⏰ Periodic auction processing active');
        console.log('🌐 API endpoints ready for requests');
    } catch (error) {
        console.error('❌ Failed to initialize keeper:', error);
        process.exit(1);
    }
}

// Handle shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Render uses this

// Start the server
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) || 3001 : 3001;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Auction Keeper running on Render - Port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`📊 API root: http://localhost:${PORT}/`);
    console.log(`🔗 External URL will be provided by Render`);
    console.log(`-------------------------------------------------------------`);
    
    // Start the full keeper initialization
    initialize();
});

// Keep the process alive and handle any uncaught errors
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});