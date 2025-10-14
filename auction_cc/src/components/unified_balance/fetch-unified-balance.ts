
import { getUnifiedBalance, isInitialized } from '../../lib/nexus/nexusClient';
import {sdk} from "../../lib/nexus/nexusClient";

// Get balance for specific token
export const result = async () => {
    return await sdk.getUnifiedBalances();
}