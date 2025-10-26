import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ConnectWalletButton from "../components/connect-button";
import {
  initializeWithProvider,
  isInitialized,
} from "../lib/nexus/nexusClient";
import { toast, Toaster } from "react-hot-toast";
import { result as fetchUnifiedBalance } from "../components/unified_balance/fetch-unified-balance";
import { useAccount } from "wagmi";

interface NavbarProps {
  activeTab?: "home" | "auctions" | "create" | "my_auctions";
  onTabChange?: (tab: "home" | "auctions" | "create" | "my_auctions") => void;
}

export default function Navbar({
  activeTab = "home",
  onTabChange,
}: NavbarProps) {
  const { isConnected } = useAccount();
  const pathname = usePathname();
  const [balance, setBalance] = useState<string | null>(null);
  const [nexusInitialized, setNexusInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (pathname === "/auctions") return "auctions";
    if (pathname === "/create") return "create";
    if (pathname === "/my_auctions") return "my_auctions";
    return "home";
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Check if Nexus is already initialized on component mount
  useEffect(() => {
    if (isInitialized()) {
      setNexusInitialized(true);
    }
  }, []);

  // Manual Nexus initialization
  const handleManualNexusInit = async () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (nexusInitialized || isInitialized()) {
      toast.error("Nexus is already initialized");
      return;
    }

    const provider = (window as any).ethereum;
    if (!provider) {
      toast.error("No ethereum provider found");
      return;
    }

    try {
      setIsInitializing(true);
      await initializeWithProvider(provider);
      setNexusInitialized(true);
      toast.success("Nexus initialized successfully!");
    } catch (error) {
      console.error("Failed to initialize Nexus:", error);
      toast.error("Failed to initialize Nexus. Please try again.");
    } finally {
      setIsInitializing(false);
    }
  };

  const handleFetchBalance = async () => {
    try {
      const bal = await fetchUnifiedBalance();
      console.log("Fetched balance:", bal);

      // Check if bal is an array and has elements
      if (
        Array.isArray(bal) &&
        bal.length > 0 &&
        bal[0].balanceInFiat !== undefined
      ) {
        setBalance(`$${bal[0].balanceInFiat}`);
      }
      // Fallback: check if bal is an object with balanceInFiat property
      else if (bal && typeof bal === "object" && "balanceInFiat" in bal) {
        setBalance(`$${bal.balanceInFiat}`);
      } else {
        setBalance("Balance unavailable");
      }
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      setBalance("Error fetching balance");
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#1a1a1a",
            color: "#fff",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />

      <nav
        className={`relative transition-all duration-300 ${
          scrolled
            ? "backdrop-blur-xl bg-black/80 border-b border-white/10"
            : "backdrop-blur-md bg-black/60 border-b border-white/5"
        }`}
      >
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-16">
            {/* Left - Brand and Navigation */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex-shrink-0">
                <div className="relative w-32 h-10 transition-transform duration-300 group-hover:scale-105">
                  <Image
                    src="/logo.png" // Put your logo in public/logo.png
                    alt="XBid Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
              </Link>

              {/* Navigation Links */}
              <div className="hidden md:flex items-center gap-6">
                <Link
                  href="/"
                  className={`text-sm font-medium transition-colors ${
                    getActiveTab() === "home"
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Home
                </Link>
                <Link
                  href="/auctions"
                  className={`text-sm font-medium transition-colors ${
                    getActiveTab() === "auctions"
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Auctions
                </Link>
                <Link
                  href="/create"
                  className={`text-sm font-medium transition-colors ${
                    getActiveTab() === "create"
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Create
                </Link>
                <Link
                  href="/my_auctions"
                  className={`text-sm font-medium transition-colors ${
                    getActiveTab() === "create"
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  My Auctions
                </Link>
              </div>
            </div>

            {/* Right - Wallet Controls */}
            <div className="flex items-center gap-3">
              {/* Init Nexus Button - Only when connected and not initialized */}
              {isConnected && !nexusInitialized && (
                <button
                  className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${
                    isInitializing
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : "bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600"
                  }`}
                  onClick={handleManualNexusInit}
                  disabled={isInitializing}
                >
                  {isInitializing ? "Initializing..." : "Init Nexus"}
                </button>
              )}

              {/* Status Badge */}
              {isConnected && (
                <div
                  className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 border ${
                    nexusInitialized
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      nexusInitialized ? "bg-emerald-400" : "bg-zinc-500"
                    }`}
                  />
                  {nexusInitialized ? "Ready" : "Not Init"}
                </div>
              )}

              {/* View Balance Button - Only when ready and no balance displayed */}
              {isConnected && nexusInitialized && !balance && (
                <button
                  className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 transition-all duration-300"
                  onClick={handleFetchBalance}
                >
                  View Balance
                </button>
              )}
              {/* Balance Display */}
              {balance && (
                <button
                  onClick={handleFetchBalance}
                  className="px-5 py-2.5 text-sm font-bold rounded-lg bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 transition-all duration-300"
                >
                  {balance}
                </button>
              )}

              {/* Wallet Button */}
              <ConnectWalletButton className="px-6 py-2.5 text-sm font-bold rounded-lg bg-white text-black hover:bg-zinc-100 transition-all duration-300 shadow-lg" />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
