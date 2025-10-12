'use client';
 
export default function ConnectButton({ className }: { className?: string }) {
  const onClick = async () => {
    const eth = (window as any)?.ethereum;
    if (!eth) return alert('Install an EIP-1193 wallet (e.g., MetaMask)');
    await eth.request?.({ method: 'eth_requestAccounts' });
    alert('Wallet already connected');
  };
  return <button className={className} onClick={onClick}>Connect Wallet</button>;
}