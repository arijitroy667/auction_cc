import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, base, optimism, polygon, sepolia, avalanche } from 'wagmi/chains';
 
export const config = getDefaultConfig({
  appName: 'Nexus SDK with RainbowKit',
  projectId: 'YOUR_PROJECT_ID', // Get this from https://cloud.walletconnect.com/
  chains: [sepolia,arbitrum, polygon, optimism, base],
  ssr: true, // If your dApp uses server side rendering (SSR)
});