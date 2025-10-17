import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrumSepolia, baseSepolia, optimismSepolia, sepolia } from 'wagmi/chains';
 
export const config = getDefaultConfig({
  appName: 'Nexus SDK with RainbowKit',
  projectId: 'YOUR_PROJECT_ID', // Get this from https://cloud.walletconnect.com/
  chains: [sepolia, arbitrumSepolia, optimismSepolia, baseSepolia],
  ssr: true, // If your dApp uses server side rendering (SSR)
});