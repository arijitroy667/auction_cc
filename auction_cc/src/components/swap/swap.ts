import type { SwapResult, ExactInSwapInput } from '@avail-project/nexus-core';
import { sdk } from '../../lib/nexus/nexusClient';
import { TOKEN_ADDRESSES } from '@/lib/constants';

/**
 * Swap tokens on the same chain using Nexus SDK swapWithExactIn
 * @param tokenIn - Symbol of the token to swap from (e.g., 'USDT')
 * @param tokenOut - Symbol of the token to swap to (e.g., 'USDC')
 * @param amount - Amount to swap (in human-readable format)
 * @param chainId - Chain ID where the swap will occur
 * @returns SwapResult from Nexus SDK
 */
export async function swapTokens(
    tokenIn: string,
    tokenOut: string,
    amount: number,
    chainId: number
): Promise<SwapResult | null> {
    try {
        console.log('[Swap] Starting token swap:', {
            tokenIn,
            tokenOut,
            amount,
            chainId
        });

        // Check if SDK is initialized
        if (!sdk.isInitialized()) {
            throw new Error('Nexus SDK is not initialized. Please initialize first.');
        }

        // Get token addresses
        const chainAddresses = TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES];
        if (!chainAddresses) {
            throw new Error(`Chain ${chainId} not supported`);
        }

        const tokenInAddress = chainAddresses[tokenIn as keyof typeof chainAddresses];
        const tokenOutAddress = chainAddresses[tokenOut as keyof typeof chainAddresses];

        if (!tokenInAddress || !tokenOutAddress) {
            throw new Error(`Token addresses not found for ${tokenIn} or ${tokenOut} on chain ${chainId}`);
        }

        // Convert amount to wei (6 decimals for USDC/USDT)
        const amountInWei = BigInt(Math.floor(amount * 1e6));

        console.log('[Swap] Token addresses:', {
            tokenInAddress,
            tokenOutAddress,
            amountInWei: amountInWei.toString()
        });

        // Prepare swap input
        const swapInput: ExactInSwapInput = {
            from: [{
                chainId,
                amount: amountInWei,
                tokenAddress: tokenInAddress as `0x${string}`
            }],
            toChainId: chainId, // Same chain swap
            toTokenAddress: tokenOutAddress as `0x${string}`
        };

        console.log('[Swap] Swap input:', swapInput);

        // Execute the swap using swapWithExactIn
        const result: SwapResult = await sdk.swapWithExactIn(swapInput);

        console.log('[Swap] Swap result:', result);

        if (!result || !result.success) {
            throw new Error('Swap transaction failed or was not completed');
        }

        console.log('[Swap] ✓ Swap completed successfully');
        console.log('[Swap] Result:', result.result);
        
        return result;

    } catch (error) {
        console.error('[Swap] Error during swap:', error);
        
        if (error instanceof Error) {
            if (error.message.includes('user rejected') || error.message.includes('User denied')) {
                console.log('[Swap] User rejected the transaction');
            } else if (error.message.includes('insufficient')) {
                console.error('[Swap] Insufficient balance or allowance');
            }
        }
        
        throw error;
    }
}

/**
 * Default export for convenience - swapWithExactIn
 */
export const result = swapTokens;
