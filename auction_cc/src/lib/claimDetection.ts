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
        '0xf08A50178dfcDe18524640EA6618a1f965821715': 'USDC',
        '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0': 'USDT',
    },
    421614: { // Arbitrum Sepolia
        '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d': 'USDC',
        '0xb9a4873d8d2C22e56b8574e8605644d08E047434': 'USDT',
    },
    84532: { // Base Sepolia
        '0x036CbD53842c5426634e7929541eC2318f3dCF7e': 'USDC',
        '0xf7e53b20f39a5f8c35005fEf37eef03A7b0d0B5a': 'USDT',
    },
    11155420: { // Optimism Sepolia
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': 'USDC',
        '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': 'USDT',
    },
};


function getChainId(chainIdentifier: string | number): number {
    if (typeof chainIdentifier === 'number') {
        if (chainIdentifier >= 0 && chainIdentifier <= 3) {
            return CHAIN_ENUM_TO_ID[chainIdentifier] || 0;
        }
        if (CHAIN_NAME_MAP[chainIdentifier]) {
            return chainIdentifier;
        }
        return 0;
    }
    
    const numericValue = parseInt(chainIdentifier);
    if (!isNaN(numericValue)) {
        if (numericValue >= 0 && numericValue <= 3) {
            return CHAIN_ENUM_TO_ID[numericValue] || 0;
        }
        if (CHAIN_NAME_MAP[numericValue]) {
            return numericValue;
        }
    }
    
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
    preferdChain: string | number; 
    sourceChain: string | number;   
    status: number;
}

interface Bid {
    intentId: string;
    bidder: string;
    amount: string;
    token: string;
    sourceChain: string | number; 
    timestamp?: string;
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
    if (auction.status !== 3) return null;
    
    if (isClaimCompleted(auction.intentId)) return null;
    
    if (auction.seller.toLowerCase() !== sellerAddress.toLowerCase()) return null;
    
    if (!bids || bids.length === 0) return null;
    
    const bidderMap = new Map<string, { 
        bidder: string; 
        amount: bigint; 
        token: string; 
        sourceChain: string | number;
        timestamp: string;
    }>();
    
    for (const bid of bids) {
        const bidderKey = bid.bidder.toLowerCase();
        const existing = bidderMap.get(bidderKey);
        
        if (existing) {
            existing.amount += BigInt(bid.amount);
            if (!bid.timestamp || (existing.timestamp && bid.timestamp > existing.timestamp)) {
                existing.timestamp = bid.timestamp || existing.timestamp;
                existing.sourceChain = bid.sourceChain;
            }
        } else {
            bidderMap.set(bidderKey, {
                bidder: bid.bidder,
                amount: BigInt(bid.amount),
                token: bid.token,
                sourceChain: bid.sourceChain,
                timestamp: bid.timestamp || '',
            });
        }
    }
    
    const aggregatedBids = Array.from(bidderMap.values());
    let winnerBid = aggregatedBids[0];
    let highestAmount = aggregatedBids[0].amount;
    
    for (const bid of aggregatedBids) {
        if (bid.amount > highestAmount) {
            highestAmount = bid.amount;
            winnerBid = bid;
        }
    }
    
    const currentChainId = getChainId(winnerBid.sourceChain);
    const currentChainName = getChainName(currentChainId);
    const currentToken = winnerBid.token;
    const currentTokenSymbol = getTokenSymbol(currentToken, currentChainId);
    
    // Determine preferred destination
    const preferredChainId = getChainId(auction.preferdChain);
    const preferredChainName = getChainName(preferredChainId);
    const preferredToken = auction.preferdToken;
    const preferredTokenSymbol = getTokenSymbol(preferredToken, preferredChainId);
    
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
