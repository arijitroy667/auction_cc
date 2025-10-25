/**
 * Types for auction claim functionality
 */

export interface PendingClaim {
    intentId: string;
    auctionId: bigint;
    sellerAddress: string;
    winnerAddress: string;
    
    // Current location of funds (where they were released)
    currentChainId: number;
    currentChainName: string;
    currentToken: string;
    currentTokenSymbol: string;
    amount: bigint;
    
    // Desired destination (from auction preferences)
    preferredChainId: number;
    preferredChainName: string;
    preferredToken: string;
    preferredTokenSymbol: string;
    
    // Status flags
    needsBridge: boolean;  // Different chain
    needsSwap: boolean;    // Different token
    canClaim: boolean;     // Can claim immediately (same chain & token)
}

export enum ClaimAction {
    NO_ACTION = 'NO_ACTION',           // Same chain & token, already claimed
    BRIDGE_ONLY = 'BRIDGE_ONLY',       // Same token, different chain
    BRIDGE_AND_SWAP = 'BRIDGE_AND_SWAP' // Different token & chain
}

export interface ClaimResult {
    success: boolean;
    txHash?: string;
    error?: string;
}
