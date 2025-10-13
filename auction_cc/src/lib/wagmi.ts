import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, arbitrum, polygon, optimism, base, avalanche } from 'wagmi/chains';
 
export const config = getDefaultConfig({
  appName: 'Nexus SDK with RainbowKit',
  projectId: 'YOUR_PROJECT_ID', // Get this from https://cloud.walletconnect.com/
  chains: [mainnet, arbitrum, polygon, optimism, base, avalanche],
  ssr: true, // If your dApp uses server side rendering (SSR)
});