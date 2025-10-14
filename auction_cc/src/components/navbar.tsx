import React, { useState } from "react";
import ConnectWalletButton from "../components/connect-button";
import {
  initializeWithProvider,
  isInitialized,
} from "../lib/nexus/nexusClient";
import { result as fetchUnifiedBalance } from "../components/unified_balance/fetch-unified-balance";

export default function Navbar() {
  const [connected, setConnected] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!isInitialized()) {
      const provider = (window as any).ethereum;
      if (provider) {
        await initializeWithProvider(provider);
        setConnected(true);
      }
    }
  };

  const handleFetchBalance = async () => {
    const bal = await fetchUnifiedBalance("AVAIL");
    setBalance(JSON.stringify(bal));
  };

  return (
    <nav className="flex gap-4 items-center px-8 py-4 bg-gray-950 border-b border-gray-800">
      <ConnectWalletButton className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition" />
      <button
        className="px-4 py-2 rounded bg-purple-500 text-white hover:bg-purple-600 transition"
        onClick={handleConnect}
      >
        Init Nexus
      </button>
      <button
        className="px-4 py-2 rounded bg-pink-500 text-white hover:bg-pink-600 transition"
        onClick={handleFetchBalance}
      >
        Fetch Unified Balance
      </button>
      {balance && (
        <span className="ml-4 text-sm text-yellow-400">Balance: {balance}</span>
      )}
    </nav>
  );
}
