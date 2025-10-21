import { PendingClaim } from '@/types/claim';

// Track completed claims in localStorage
const COMPLETED_CLAIMS_KEY = 'completed_claims';

function getCompletedClaims(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const stored = localStorage.getItem(COMPLETED_CLAIMS_KEY);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
}

export function markClaimAsCompleted(intentId: string): void {
    if (typeof window === 'undefined') return;
    try {
        const completed = getCompletedClaims();
        completed.add(intentId);
        localStorage.setItem(COMPLETED_CLAIMS_KEY, JSON.stringify([...completed]));
    } catch (error) {
        console.error('Failed to mark claim as completed:', error);
    }
}

function isClaimCompleted(intentId: string): boolean {
    return getCompletedClaims().has(intentId);
}

// Chain enum mapping (contract uses uint8: 0=Ethereum, 1=Arbitrum, 2=Base, 3=Optimism)
const CHAIN_ENUM_TO_ID: { [key: number]: number } = {
    0: 11155111,  // Ethereum Sepolia
    1: 421614,    // Arbitrum Sepolia
    2: 84532,     // Base Sepolia
    3: 11155420,  // Optimism Sepolia
};

// String identifiers to chain ID (for backward compatibility)
const CHAIN_STRING_TO_ID: { [key: string]: number } = {
    'ethereum': 11155111,
    'arbitrumSepolia': 421614,
    'base': 84532,
    'optimism': 11155420,
    'Ethereum Sepolia': 11155111,
    'Arbitrum Sepolia': 421614,
    'Base Sepolia': 84532,
    'Optimism Sepolia': 11155420,
};

const CHAIN_NAME_MAP: { [key: number]: string } = {
    11155111: 'Ethereum Sepolia',
    421614: 'Arbitrum Sepolia',
    84532: 'Base Sepolia',
    11155420: 'Optimism Sepolia',
};

// Token address to symbol mappings per chain
const TOKEN_SYMBOL_MAP: { [chainId: number]: { [address: string]: string } } = {
    11155111: { // Ethereum Sepolia
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': 'USDC',
        '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06': 'USDT',
    },
    421614: { // Arbitrum Sepolia
        '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d': 'USDC',
        '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E': 'USDT',
    },
    84532: { // Base Sepolia
        '0x036CbD53842c5426634e7929541eC2318f3dCF7e': 'USDC',
        '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9': 'USDT',
    },
    11155420: { // Optimism Sepolia
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': 'USDC',
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT',
    },
};

/**
 * Parse chain identifier (can be uint8, string number, or string name) to chain ID
 */
function getChainId(chainIdentifier: string | number): number {
    // If it's already a valid chain ID, return it
    if (typeof chainIdentifier === 'number') {
        // Check if it's a chain enum (0-3)
        if (chainIdentifier >= 0 && chainIdentifier <= 3) {
            return CHAIN_ENUM_TO_ID[chainIdentifier] || 0;
        }
        // Check if it's already a chain ID
        if (CHAIN_NAME_MAP[chainIdentifier]) {
            return chainIdentifier;
        }
        return 0;
    }
    
    // Try parsing as number first
    const numericValue = parseInt(chainIdentifier);
    if (!isNaN(numericValue)) {
        // Check if it's a chain enum (0-3)
        if (numericValue >= 0 && numericValue <= 3) {
            return CHAIN_ENUM_TO_ID[numericValue] || 0;
        }
        // Check if it's already a chain ID
        if (CHAIN_NAME_MAP[numericValue]) {
            return numericValue;
        }
    }
    
    // Try as string identifier
    return CHAIN_STRING_TO_ID[chainIdentifier] || 0;
}

function getChainName(chainId: number): string {
    return CHAIN_NAME_MAP[chainId] || 'Unknown Chain';
}

function getTokenSymbol(tokenAddress: string, chainId: number): string {
    const chainTokens = TOKEN_SYMBOL_MAP[chainId];
    if (!chainTokens) return 'UNKNOWN';
    
    const normalizedAddress = tokenAddress.toLowerCase();
    for (const [addr, symbol] of Object.entries(chainTokens)) {
        if (addr.toLowerCase() === normalizedAddress) {
            return symbol;
        }
    }
    return 'UNKNOWN';
}

interface Auction {
    intentId: string;
    seller: string;
    preferdToken: string;
    preferdChain: string | number; // Can be chain enum (0-3), chain ID, or string
    sourceChain: string | number;   // Can be chain enum (0-3), chain ID, or string
    status: number;
}

interface Bid {
    intentId: string;
    bidder: string;
    amount: string;
    token: string;
    sourceChain: string | number; // Can be chain enum (0-3), chain ID, or string
}

/**
 * Detects if an auction has pending claims for the seller
 * Returns PendingClaim object if funds need to be claimed
 */
export function detectPendingClaim(
    auction: Auction,
    bids: Bid[],
    sellerAddress: string
): PendingClaim | null {
    // Only check settled auctions (status 3 according to AuctionStatus enum)
    if (auction.status !== 3) return null;
    
    // Skip if claim has already been completed
    if (isClaimCompleted(auction.intentId)) return null;
    
    // Only for the actual seller
    if (auction.seller.toLowerCase() !== sellerAddress.toLowerCase()) return null;
    
    // Find winning bid (highest amount)
    if (!bids || bids.length === 0) return null;
    
    let winnerBid = bids[0];
    let highestAmount = BigInt(bids[0].amount);
    
    for (const bid of bids) {
        const bidAmount = BigInt(bid.amount);
        if (bidAmount > highestAmount) {
            highestAmount = bidAmount;
            winnerBid = bid;
        }
    }
    
    // Determine current location (where funds were released = winner's chain)
    const currentChainId = getChainId(winnerBid.sourceChain);
    const currentChainName = getChainName(currentChainId);
    const currentToken = winnerBid.token;
    const currentTokenSymbol = getTokenSymbol(currentToken, currentChainId);
    
    // Determine preferred destination
    const preferredChainId = getChainId(auction.preferdChain);
    const preferredChainName = getChainName(preferredChainId);
    const preferredToken = auction.preferdToken;
    const preferredTokenSymbol = getTokenSymbol(preferredToken, preferredChainId);
    
    // Debug logging
    console.log('[ClaimDetection] Processing claim:', {
        intentId: auction.intentId,
        winnerSourceChain: winnerBid.sourceChain,
        currentChainId,
        currentChainName,
        currentToken,
        currentTokenSymbol,
        auctionPreferdChain: auction.preferdChain,
        preferredChainId,
        preferredChainName,
        preferredToken,
        preferredTokenSymbol,
    });
    
    // Calculate flags
    const needsBridge = currentChainId !== preferredChainId;
    const needsSwap = currentTokenSymbol !== preferredTokenSymbol;
    const canClaim = !needsBridge && !needsSwap; // Already on correct chain with correct token
    
    return {
        intentId: auction.intentId,
        auctionId: BigInt(auction.intentId), // For compatibility
        sellerAddress: auction.seller,
        winnerAddress: winnerBid.bidder,
        
        currentChainId,
        currentChainName,
        currentToken,
        currentTokenSymbol,
        amount: BigInt(winnerBid.amount),
        
        preferredChainId,
        preferredChainName,
        preferredToken,
        preferredTokenSymbol,
        
        needsBridge,
        needsSwap,
        canClaim,
    };
}

/**
 * Batch detect pending claims for multiple auctions
 */
export function detectPendingClaims(
    auctions: Auction[],
    auctionBids: { [intentId: string]: Bid[] },
    sellerAddress: string
): PendingClaim[] {
    const claims: PendingClaim[] = [];
    
    for (const auction of auctions) {
        const bids = auctionBids[auction.intentId] || [];
        const claim = detectPendingClaim(auction, bids, sellerAddress);
        if (claim) {
            claims.push(claim);
        }
    }
    
    return claims;
}
