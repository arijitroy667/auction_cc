"use client";

import { useAccount } from "wagmi";
import {toast,Toaster} from 'react-hot-toast';
import { initializeWithProvider, isInitialized } from "../lib/nexus/nexusClient";

export default function InitButton({
  className,
  onReady,
}: {
  className?: string;
  onReady?: () => void;
}) {
  const { connector } = useAccount();

  const onClick = async () => {
    try {
      // Get the provider from the connected wallet
      const provider = await connector?.getProvider();
      if (!provider) throw new Error("No provider found");

      // We're calling our wrapper function from the lib/nexus.ts file here.
      await initializeWithProvider(provider);
      onReady?.();
      toast.success("Nexus initialized");
    } catch (e: any) {
      toast.error(e?.message ?? "Init failed");
    }
  };
  return (
    <div>
      <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1a1a1a',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      <button className={className} onClick={onClick} disabled={isInitialized()}>
        Initialize Nexus
      </button>
      
    </div>
  );
}
