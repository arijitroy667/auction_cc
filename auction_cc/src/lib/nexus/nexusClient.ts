
import { NexusSDK } from '@avail-project/nexus-core';

// Add polyfill for Buffer in browser environment
if (typeof window !== 'undefined') {
  if (!global.Buffer) {
    const { Buffer } = require('buffer');
    global.Buffer = Buffer;
  }
  if (!window.Buffer) {
    window.Buffer = global.Buffer;
  }
}
 
export const sdk = new NexusSDK({ network: 'testnet'});

// Thin wrapper that calls sdk.isInitialized() from the SDK
export function isInitialized() {
  return sdk.isInitialized();
}
 
export async function initializeWithProvider(provider: any) {
  if (!provider) throw new Error("No EIP-1193 provider (e.g., MetaMask) found");

  //If the SDK is already initialized, return
  if (sdk.isInitialized()) return;

  //If the SDK is not initialized, initialize it with the provider passed as a parameter
  await sdk.initialize(provider);
}

export async function deinit() {
  //If the SDK is not initialized, return
  if (!sdk.isInitialized()) return;

  //If the SDK is initialized, de-initialize it
  await sdk.deinit();
}

export async function getUnifiedBalances() {
  //Get the unified balances from the SDK
  return await sdk.getUnifiedBalances();
}
