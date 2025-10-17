"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const event_listner_1 = require("./event-listner");
const auction_processor_1 = require("./auction-processor");
const config_1 = require("./config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize event listeners once (only in development or when needed)
let listenersInitialized = false;
function initializeListenersOnce() {
    if (!listenersInitialized && process.env.NODE_ENV !== 'production') {
        (0, event_listner_1.startEventListeners)();
        listenersInitialized = true;
    }
}
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});
// Get all auctions
app.get('/api/auctions', (req, res) => {
    try {
        initializeListenersOnce();
        const auctions = (0, event_listner_1.getAllAuctions)();
        const auctionsArray = Array.from(auctions.entries()).map(([intentId, auction]) => ({
            intentId,
            ...auction
        }));
        res.json({
            success: true,
            count: auctionsArray.length,
            data: auctionsArray
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch auctions',
            details: errorMessage
        });
    }
});
// Get specific auction by intentId
app.get('/api/auctions/:intentId', (req, res) => {
    try {
        initializeListenersOnce();
        const { intentId } = req.params;
        const auctions = (0, event_listner_1.getAllAuctions)();
        const auction = auctions.get(intentId);
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
                ...auction
            }
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch auction',
            details: errorMessage
        });
    }
});
// Get all bids
app.get('/api/bids', (req, res) => {
    try {
        initializeListenersOnce();
        const allBids = (0, event_listner_1.getAllBids)();
        const bidsArray = Array.from(allBids.entries()).map(([intentId, bids]) => ({
            intentId,
            bids
        }));
        res.json({
            success: true,
            count: bidsArray.length,
            data: bidsArray
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bids',
            details: errorMessage
        });
    }
});
// Get bids for specific auction
app.get('/api/bids/:intentId', (req, res) => {
    try {
        initializeListenersOnce();
        const { intentId } = req.params;
        const allBids = (0, event_listner_1.getAllBids)();
        const bids = allBids.get(intentId) || [];
        res.json({
            success: true,
            intentId,
            count: bids.length,
            data: bids
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch bids for auction',
            details: errorMessage
        });
    }
});
// Manually trigger auction processing
app.post('/api/process-auctions', async (req, res) => {
    try {
        console.log('[API] Manual auction processing triggered');
        await (0, auction_processor_1.processEndedAuctions)();
        res.json({
            success: true,
            message: 'Auction processing completed',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[API] Manual auction processing failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process auctions',
            details: errorMessage
        });
    }
});
// Get keeper configuration (without sensitive data)
app.get('/api/config', (req, res) => {
    try {
        const safeConfig = {
            chains: Object.fromEntries(Object.entries(config_1.CONFIG.chains).map(([key, chain]) => [
                key,
                {
                    id: chain.id,
                    name: chain.name,
                    hasAuctionHub: !!chain.auctionHubAddress,
                    hasBidManager: !!chain.bidManagerAddress
                }
            ])),
            processingInterval: config_1.CONFIG.processingInterval,
            environment: process.env.NODE_ENV || 'development'
        };
        res.json({
            success: true,
            data: safeConfig
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch configuration',
            details: errorMessage
        });
    }
});
// Get system stats
app.get('/api/stats', (req, res) => {
    try {
        initializeListenersOnce();
        const auctions = (0, event_listner_1.getAllAuctions)();
        const allBids = (0, event_listner_1.getAllBids)();
        const stats = {
            totalAuctions: auctions.size,
            totalBids: Array.from(allBids.values()).reduce((sum, bids) => sum + bids.length, 0),
            auctionsByChain: {},
            bidsByChain: {}
        };
        // Count auctions by chain
        for (const auction of auctions.values()) {
            const chain = auction.sourceChain;
            stats.auctionsByChain[chain] = (stats.auctionsByChain[chain] || 0) + 1;
        }
        // Count bids by chain
        for (const bids of allBids.values()) {
            for (const bid of bids) {
                const chain = bid.sourceChain;
                stats.bidsByChain[chain] = (stats.bidsByChain[chain] || 0) + 1;
            }
        }
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            success: false,
            error: 'Failed to fetch stats',
            details: errorMessage
        });
    }
});
// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});
// 404 handler - Express 5 compatible
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});
// Export the Express app for Vercel
exports.default = app;
// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001;
    // Initialize event listeners for local development
    (0, event_listner_1.startEventListeners)();
    // Start periodic auction processing for local development
    setInterval(async () => {
        try {
            await (0, auction_processor_1.processEndedAuctions)();
        }
        catch (error) {
            console.error('❌ Error in periodic auction processing:', error);
        }
    }, config_1.CONFIG.processingInterval);
    app.listen(PORT, () => {
        console.log(`🌐 Keeper API server running on port ${PORT}`);
        console.log(`📡 Health check: http://localhost:${PORT}/health`);
        console.log(`📋 API endpoints:`);
        console.log(`   GET  /api/auctions           - Get all auctions`);
        console.log(`   GET  /api/auctions/:id       - Get specific auction`);
        console.log(`   GET  /api/bids               - Get all bids`);
        console.log(`   GET  /api/bids/:id           - Get bids for auction`);
        console.log(`   POST /api/process-auctions   - Manually trigger processing`);
        console.log(`   GET  /api/config             - Get keeper configuration`);
        console.log(`   GET  /api/stats              - Get system statistics`);
    });
}
