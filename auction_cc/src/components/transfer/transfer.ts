import { TransferParams,TransferResult } from "@avail-project/nexus-core";
import { sdk } from "../../lib/nexus/nexusClient";

export const result = async (token: string, amount: number, chainId: number,recipient: string,sourceChain?: number[]): Promise<TransferResult> => {
    return await sdk.transfer({
        token: token,
        amount: amount,
        chainId: chainId,
        recipient: recipient,
        sourceChains: sourceChain,
    } as TransferParams);
}