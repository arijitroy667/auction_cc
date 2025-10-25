"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { isInitialized } from "@/lib/nexus/nexusClient";
import { result } from "@/components/unified_balance/fetch-unified-balance";
import Navbar from "@/components/navbar";
import Link from "next/link";

export default function Page() {
  const { isConnected } = useAccount();
  const [initialized, setInitialized] = useState(isInitialized());
  const [balances, setBalances] = useState<any>(null);
  const [assetDatum, setAssetDatum] = useState<any>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const checkInitialization = () => {
      const nexusReady = isInitialized();
      if (nexusReady !== initialized) {
        setInitialized(nexusReady);
      }
    };

    checkInitialization();
    const interval = setInterval(checkInitialization, 1000);
    return () => clearInterval(interval);
  }, [initialized]);

  useEffect(() => {
    const fetchAssetDatum = async () => {
      if (initialized && isConnected) {
        const data = await result();
        setAssetDatum(data);
      } else {
        setAssetDatum(null);
      }
    };
    fetchAssetDatum();
  }, [initialized, isConnected]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden bg-black">
      {/* Monochrome Background Pattern */}
      <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>

      {/* Dynamic cursor effect - Monochrome */}
      <div
        className="fixed w-96 h-96 pointer-events-none z-0 opacity-20 transition-all duration-1000 ease-out"
        style={{
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
        }}
      />

      {/* Fixed Status Indicator - Top Right */}
      <div className="fixed top-20 right-6 z-50">
        {!isConnected && (
          <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-500/50 rounded-full px-5 py-2.5 shadow-xl shadow-gray-500/30 hover:shadow-gray-500/50 transition-all duration-300 group cursor-default">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-pulse" />
              <div className="text-sm">
                <p className="text-gray-200 font-semibold">Not Connected</p>
              </div>
            </div>
          </div>
        )}

        {isConnected && !initialized && (
          <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-500/50 rounded-full px-5 py-2.5 shadow-xl shadow-gray-500/30 hover:shadow-gray-500/50 transition-all duration-300 group cursor-default">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              <div className="text-sm">
                <p className="text-gray-200 font-semibold">Initialize Nexus</p>
              </div>
            </div>
          </div>
        )}

        {isConnected && initialized && (
          <div className="bg-gradient-to-r from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-500/50 rounded-full px-5 py-2.5 shadow-xl shadow-gray-500/30 hover:shadow-gray-500/50 transition-all duration-300 group cursor-default">
            <div className="flex items-center space-x-2.5">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              <div className="text-sm">
                <p className="text-gray-200 font-semibold">Nexus Initialized</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Navbar activeTab="home" onTabChange={() => {}} />
        
        <main className="max-w-7xl mx-auto px-8">
          {/* Hero Section - Compact */}
          <section className="text-center py-20 pt-40">
            <div className="mb-12 space-y-4">
              <h1 className="text-5xl md:text-6xl font-black leading-tight tracking-tighter">
                <div className="bg-gradient-to-r from-white via-gray-300 to-white bg-clip-text text-transparent mb-2">
                  Next-Gen NFT Auctions
                </div>
                <div className="bg-gradient-to-r from-gray-400 via-gray-300 to-gray-400 bg-clip-text text-transparent bg-[length:200%] ">
                  for the modern world
                </div>
              </h1>

              <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Create and participate in NFT auctions across multiple blockchains. 
                Powered by Nexus for seamless cross-chain transactions.
              </p>
            </div>

            {/* CTA Buttons - Compact with Monochrome theme */}
            <div className="flex flex-wrap gap-4 justify-center mb-12">
              <Link 
                href="/auctions"
                className="relative group bg-gradient-to-r from-black via-gray-900/45 to-gray-600/30 text-white px-10 py-3 rounded-xl hover:from-black hover:via-black hover:to-black transition-all duration-300 transform hover:scale-105 shadow-xl shadow-gray-500/50 hover:shadow-2xl hover:shadow-gray-500/70 font-bold overflow-hidden cursor-pointer border border-gray-400/30 hover:border-gray-300/60"
              >
                <span className="relative z-10 flex items-center space-x-2">
                  <span>Browse Auctions</span>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              </Link>

              <Link
                href="/create"
                className="relative group bg-gradient-to-r from-black via-gray-900/45 to-gray-600/30 text-white px-10 py-3 rounded-xl hover:from-black hover:via-black hover:to-black transition-all duration-300 transform hover:scale-105 shadow-xl shadow-gray-500/50 hover:shadow-2xl hover:shadow-gray-500/70 font-bold overflow-hidden cursor-pointer border border-gray-400/30 hover:border-gray-300/60"
              >
                <span>Create Auction</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              </Link>
            </div>
          </section>

          {/* Features Section - Compact with Monochrome theme */}
          <section className="py-16">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-black mb-4 bg-gradient-to-r from-white via-gray-300 to-white bg-clip-text text-transparent">
                Why Choose Our Platform?
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Experience the future of cross-chain NFT auctions with unparalleled security, speed, and transparency.
              </p>
            </div>

            {/* Feature Cards - 2x2 Grid, Compact with Monochrome theme */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto mb-12">
              {[
                {
                  title: "Smart Security",
                  description: "Smart contracts keep your NFTs and funds secure.",
                  gradient: "from-gray-700/20 to-black-100/5",
                  border: "border-gray-500/40",
                  hoverBorder: "hover:border-gray-400/70",
                  icon: "🔒"
                },
                {
                  title: "Nexus Magic",
                  description: "Seamless cross-chain auctions powered by Nexus technology.",
                  gradient: "from-gray-700/20 to-black-100/5",
                  border: "border-gray-500/40",
                  hoverBorder: "hover:border-gray-400/70",
                  icon: "⚡"
                },
                {
                  title: "Live Analytics",
                  description: "Track bids and prices in real-time for better decisions.",
                  gradient: "from-gray-700/20 to-black-100/5",
                  border: "border-gray-500/40",
                  hoverBorder: "hover:border-gray-400/70",
                  icon: "📊"
                },
                {
                  title: "Automated Refunds",
                  description: "Automatic repayment of outbid amounts ensures fairness.",
                  gradient: "from-gray-700/20 to-black-100/5",
                  border: "border-gray-500/40",
                  hoverBorder: "hover:border-gray-400/70",
                  icon: "💰"
                }
              ].map((feature, index) => (
                <div
                  key={index}
                  className={`relative bg-gradient-to-br ${feature.gradient} backdrop-blur-2xl border ${feature.border} ${feature.hoverBorder} rounded-2xl p-6 hover:transform hover:scale-[1.02] transition-all duration-500 group overflow-hidden`}
                >
                  <div className="absolute inset-0 opacity-5">
                    <div className="w-full h-full bg-gradient-to-br from-white/10 to-transparent" />
                  </div>

                  <div className="relative z-10">
                    <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-black text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}