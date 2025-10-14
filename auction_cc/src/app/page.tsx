"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import ConnectWalletButton from "@/components/connect-button";
import InitButton from "@/components/init-button";
import DeinitButton from "@/components/de-init-button";
import { isInitialized } from "@/lib/nexus/nexusClient";
import { result } from "@/components/unified_balance/fetch-unified-balance";
import AuctionPage from "@/components/auction/auction-page";

export default function Page() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [balances, setBalances] = useState<any>(null);
  const [assetDatum, setAssetDatum] = useState<any>(null);

  const btn =
    "px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  useEffect(() => {
    const fetchAssetDatum = async () => {
      if (initialized && isConnected) {
        const data = await result("USDC");
        setAssetDatum(data);
      } else {
        setAssetDatum(null);
      }
    };
    fetchAssetDatum();
  }, [initialized, isConnected]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      {/* <div className="flex flex-col items-center gap-4">
        <ConnectWalletButton className={btn} />
        <InitButton className={btn} onReady={() => setInitialized(true)} />
        <h1 className="text-2xl font-bold">
          {assetDatum ? JSON.stringify(assetDatum) : "No asset data"}
        </h1>
        <DeinitButton
          className={btn}
          onDone={() => {
            setInitialized(false);
            setBalances(null);
            setAssetDatum(null);
          }}
        />

        <div className="mt-2">
          <b>Wallet Status:</b> {isConnected ? "Connected" : "Not connected"}
        </div>
        <div className="mt-2">
          <b>Nexus SDK Initialization Status:</b>{" "}
          {initialized ? "Initialized" : "Not initialized"}
        </div>

        {balances && (
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(balances, null, 2)}
          </pre>
        )}
      </div> */}
      <AuctionPage />
    </main>
  );
}
