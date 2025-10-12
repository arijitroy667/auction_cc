'use client';
 
import { initializeWithProvider, isInitialized } from '../lib/nexus/nexusClient';
 
export default function InitButton({
  className,
  onReady,
}: { className?: string; onReady?: () => void }) {
  const onClick = async () => {
    const eth = (window as any)?.ethereum;
    try {
      // We're calling our wrapper function from the lib/nexus.ts file here.
      // Essentially calls "sdk.initialize(provider)" - SDK method.
      await initializeWithProvider(eth);
      onReady?.();
      alert('Nexus initialized');
    } catch (e: any) {
      alert(e?.message ?? 'Init failed');
    }
  };
  return <button className={className} onClick={onClick} disabled={isInitialized()}>Initialize Nexus</button>;
}