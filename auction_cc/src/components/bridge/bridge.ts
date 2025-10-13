import type { BridgeParams, BridgeResult } from '@avail-project/nexus-core';
import {sdk} from '../../lib/nexus/nexusClient';


export const result = async (token: string, amount: number, chainId: number, sourceChains?: number[]): Promise<BridgeResult> => {
    return await sdk.bridge({
        token: token,
        amount: amount,
        chainId: chainId,
        sourceChains: sourceChains,
    } as BridgeParams);
}

