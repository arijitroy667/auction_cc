'use client';
 
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { TransactionPopupProvider } from '@blockscout/app-sdk';
import { config } from '@/lib/wagmi';
import '@rainbow-me/rainbowkit/styles.css';
 
const queryClient = new QueryClient();
 
export function Providers({ children }: { children: React.ReactNode }) {
  return (
   
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <TransactionPopupProvider>
            {children}
          </TransactionPopupProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
    
  );
}