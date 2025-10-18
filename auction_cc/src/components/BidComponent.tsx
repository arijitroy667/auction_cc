import { useState, useEffect } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { result as nexusTransfer } from './transfer/transfer';
import { resultForToken } from './unified_balance/fetch-unified-balance';
import { TOKEN_ADDRESSES, SUPPORTED_TOKENS, CHAIN_NAMES, BID_MANAGER_ADDRESS, type SupportedToken } from '@/lib/constants';
import BidManagerABI from '@/abis/BidManager.json';

interface BidFormProps {
  auctionId: string;
  startingPrice: string;
  reservePrice: string;
  onBidSubmit: (amount: string) => Promise<void>;
  onClose: () => void;
}

export default function BidForm({ auctionId, startingPrice, reservePrice, onBidSubmit, onClose }: BidFormProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState<number>(11155111); // Target chain where BidManager will receive funds
  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDC');
  const [unifiedBalance, setUnifiedBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [highestBid, setHighestBid] = useState<number>(0);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [existingBid, setExistingBid] = useState<number>(0); // Track user's existing bid amount
  const [existingBidToken, setExistingBidToken] = useState<string | null>(null); // Track token used in existing bid
  const { isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const supportedChains = Object.keys(CHAIN_NAMES).map(Number);

  // Fetch highest bid for this auction
  useEffect(() => {
    const fetchHighestBid = async () => {
      setBidsLoading(true);
      try {
        const response = await fetch(`http://localhost:3001/api/bids/${auctionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.length > 0) {
            // Find the highest bid amount
            const maxBid = Math.max(...data.data.map((bid: any) => parseFloat(ethers.formatEther(bid.amount))));
            setHighestBid(maxBid);
          } else {
            setHighestBid(0);
          }
        }
      } catch (error) {
        console.error('Failed to fetch bids:', error);
        setHighestBid(0);
      } finally {
        setBidsLoading(false);
      }
    };

    fetchHighestBid();
  }, [auctionId]);

  // Fetch user's existing bid from the contract
  useEffect(() => {
    const fetchExistingBid = async () => {
      if (!isConnected || !address || !walletClient) return;

      try {
        const provider = new ethers.BrowserProvider(walletClient as any);
        const bidManagerContract = new ethers.Contract(
          BID_MANAGER_ADDRESS,
          BidManagerABI,
          provider
        );

        const intentIdBytes32 = ethers.zeroPadValue(ethers.toBeHex(auctionId), 32);
        
        // Call lockedBids mapping to get user's existing bid
        const bid = await bidManagerContract.lockedBids(intentIdBytes32, address);
        
        if (bid && bid.amount > 0) {
          // Assuming 6 decimals for USDC/USDT
          const existingAmount = parseFloat(ethers.formatUnits(bid.amount, 6));
          setExistingBid(existingAmount);
          setExistingBidToken(bid.token);
          console.log('User has existing bid:', existingAmount, 'with token:', bid.token);
        } else {
          setExistingBid(0);
          setExistingBidToken(null);
        }
      } catch (error) {
        console.error('Failed to fetch existing bid:', error);
        setExistingBid(0);
        setExistingBidToken(null);
      }
    };

    fetchExistingBid();
  }, [auctionId, isConnected, address, walletClient]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected) return;
      
      setBalanceLoading(true);
      try {
        const balanceData = await resultForToken(selectedToken);
        // balanceData contains unified balance across all chains
        // Since USDC/USDT are stablecoins, the amount represents dollars
        if (balanceData && 'balanceInFiat' in balanceData) {
            console.log('Setting unified balance to:', balanceData?.balanceInFiat);
          setUnifiedBalance(balanceData?.balanceInFiat || 0);
        } else {
          setUnifiedBalance(0);
        }
      } catch (error) {
        console.error('Failed to fetch unified balance:', error);
        setUnifiedBalance(0);
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchBalance();
  }, [selectedToken, isConnected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      alert('Please connect your wallet first');
      return;
    }

    if (!walletClient) {
      alert('Wallet client not available');
      return;
    }

    const newTotalBidAmount = parseFloat(amount);
    if (isNaN(newTotalBidAmount) || newTotalBidAmount <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }

    // Check if user is increasing an existing bid
    if (existingBid > 0) {
      if (newTotalBidAmount <= existingBid) {
        alert(`Your new bid must be higher than your existing bid of $${existingBid.toFixed(2)}`);
        return;
      }
      
      // Verify user is using the same token
      const tokenAddress = TOKEN_ADDRESSES[selectedChain as keyof typeof TOKEN_ADDRESSES][selectedToken];
      if (existingBidToken && existingBidToken.toLowerCase() !== tokenAddress?.toLowerCase()) {
        alert(`You must use the same token (${selectedToken}) as your existing bid`);
        return;
      }
    }

    // Parse starting and reserve prices
    const startingPriceNum = parseFloat(ethers.formatEther(startingPrice));
    const reservePriceNum = parseFloat(ethers.formatEther(reservePrice));

    // Validation logic for Dutch auction (prices decrease over time)
    if (highestBid === 0) {
      // First bidder: must bid between reserve and starting price
      if (newTotalBidAmount < reservePriceNum || newTotalBidAmount > startingPriceNum) {
        alert(`First bid must be between $${reservePriceNum.toFixed(2)} (reserve) and $${startingPriceNum.toFixed(2)} (starting price)`);
        return;
      }
    } else {
      // Subsequent bidders: must bid lower than the current lowest bid
      // and must be at or above reserve price
      if (newTotalBidAmount < highestBid || newTotalBidAmount > startingPriceNum) {
        alert(`Your bid must be between $${highestBid.toFixed(2)} (current lowest) and $${startingPriceNum.toFixed(2)} (starting price)`);
        return;
      }
    }

    // Calculate the incremental amount needed
    const incrementalAmount = existingBid > 0 ? newTotalBidAmount - existingBid : newTotalBidAmount;

    if (incrementalAmount > unifiedBalance) {
      alert(`Insufficient balance. You need $${incrementalAmount.toFixed(2)} more, but only have $${unifiedBalance.toFixed(2)} ${selectedToken} available across all chains.`);
      return;
    }

    try {
      setLoading(true);

      console.log('Initiating cross-chain transfer via Nexus SDK...');
      console.log(`Total Bid Amount: $${newTotalBidAmount} ${selectedToken}`);
      console.log(`Existing Bid: $${existingBid}`);
      console.log(`Incremental Amount to Transfer: $${incrementalAmount} ${selectedToken}`);
      console.log(`Target Chain: ${CHAIN_NAMES[selectedChain as keyof typeof CHAIN_NAMES]}`);
      console.log(`Recipient (BidManager): ${BID_MANAGER_ADDRESS}`);

      // Use Nexus SDK transfer - only transfer the incremental amount needed
      // It will automatically aggregate tokens from all chains
      const transferResult = await nexusTransfer(
        selectedToken,        // token symbol (USDC or USDT)
        incrementalAmount,   // only transfer the additional amount needed
        selectedChain,       // target chainId where BidManager will receive funds
        BID_MANAGER_ADDRESS, // recipient address (BidManager contract)
        undefined            // sourceChains - let SDK auto-select from available balances
      );

      console.log('Nexus transfer completed:', transferResult);

      if (!transferResult || !transferResult.success) {
        throw new Error('Transfer failed or was not completed');
      }

      // After successful transfer, the tokens are now on the target chain at BidManager
      console.log(`Tokens successfully transferred to BidManager contract on target chain (${incrementalAmount} ${selectedToken})`);

      // Now we call placeBid on the BidManager contract
      // Note: No approval needed since funds are already in the BidManager contract
      console.log('Placing bid on BidManager...');
      
      // Get the token address for the selected chain and token
      const tokenAddress = TOKEN_ADDRESSES[selectedChain as keyof typeof TOKEN_ADDRESSES][selectedToken];
      
      if (!tokenAddress) {
        throw new Error(`Token address not found for ${selectedToken} on chain ${selectedChain}`);
      }

      // Convert the INCREMENTAL amount to wei (assuming 6 decimals for USDC/USDT)
      // The smart contract will add this to the existing bid amount
      const amountInWei = ethers.parseUnits(incrementalAmount.toString(), 6);

      // Create a provider and signer for the transaction
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();

      // Create contract instance
      const bidManagerContract = new ethers.Contract(
        BID_MANAGER_ADDRESS,
        BidManagerABI,
        signer
      );

      // Convert auctionId to bytes32 format
      const intentIdBytes32 = ethers.zeroPadValue(ethers.toBeHex(auctionId), 32);

      // Call placeBid function
      console.log('Placing bid with params:', {
        intentId: intentIdBytes32,
        token: tokenAddress,
        amount: amountInWei.toString()
      });

      const tx = await bidManagerContract.placeBid(
        intentIdBytes32,
        tokenAddress,
        amountInWei
      );

      console.log('Transaction sent:', tx.hash);
      await tx.wait();
      console.log('Bid successfully placed on-chain!');

      // Call the parent callback
      await onBidSubmit(amount);
      onClose();
    } catch (error) {
      console.error('Bid failed:', error);
      alert(`Failed to place bid: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Place Bid</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bid Range Display */}
          <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30">
            <div className="text-sm text-zinc-400 mb-2">
              {bidsLoading ? (
                <span>Loading bid information...</span>
              ) : highestBid === 0 ? (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span>First Bid - Acceptable Range:</span>
                  </div>
                  <div className="text-lg font-bold text-white">
                    ${parseFloat(ethers.formatEther(reservePrice)).toFixed(2)} - ${parseFloat(ethers.formatEther(startingPrice)).toFixed(2)}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    First bidders must bid between reserve and starting price
                  </p>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span>Current Lowest Bid:</span>
                    <span className="text-lg font-bold text-green-400">${highestBid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span>Your Bid Range:</span>
                    <span className="text-sm text-white">${highestBid.toFixed(2)} - ${parseFloat(ethers.formatEther(startingPrice)).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Dutch Auction: Bid lower than previous bids (between current lowest and starting price)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Existing Bid Display (if user has one) */}
          {existingBid > 0 && (
            <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Your Current Bid:</span>
                <span className="text-lg font-bold text-yellow-400">${existingBid.toFixed(2)}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                💡 You can increase your bid. Only the additional amount will be transferred.
              </p>
            </div>
          )}

          {/* Available Balance Display */}
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Available Balance (All Chains):</span>
              <span className="text-lg font-bold text-white">
                {balanceLoading ? (
                  <span className="text-sm text-zinc-400">Loading...</span>
                ) : (
                  `$${unifiedBalance.toFixed(2)}`
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Unified {selectedToken} balance across Sepolia, Arbitrum, Base & Optimism
            </p>
          </div>

          {/* Target Chain Selection */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Target Chain (Where to send funds)</label>
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-lg bg-black border border-zinc-800 text-white focus:border-blue-500 focus:outline-none"
              required
            >
              {supportedChains.map((chainId) => (
                <option key={chainId} value={chainId}>
                  {CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              Funds will be automatically aggregated from all chains and sent to this chain
            </p>
          </div>

          {/* Token Selection */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Select Token</label>
            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setSelectedToken(token)}
                  className={`px-4 py-3 rounded-lg font-semibold transition-all ${
                    selectedToken === token
                      ? 'bg-blue-500 text-white border-2 border-blue-400'
                      : 'bg-black text-zinc-400 border border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          {/* Bid Amount in USD */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              Bid Amount (USD)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-lg">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max={unifiedBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-lg bg-black border border-zinc-800 text-white focus:border-blue-500 focus:outline-none"
                placeholder="0.00"
                required
              />
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              1 {selectedToken} = $1.00 USD • Max: ${unifiedBalance.toFixed(2)}
            </p>
          </div>

          {/* Summary */}
          <div className="bg-black/50 rounded-lg p-4 border border-zinc-800">
            <h4 className="text-white text-sm font-semibold mb-2">Transaction Summary</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400">Target Chain:</span>
                <span className="text-white">{CHAIN_NAMES[selectedChain as keyof typeof CHAIN_NAMES]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Token:</span>
                <span className="text-white">{selectedToken}</span>
              </div>
              {existingBid > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Current Bid:</span>
                    <span className="text-white">${existingBid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">New Total Bid:</span>
                    <span className="text-white font-semibold">${amount || '0.00'} USD</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-yellow-400">Amount to Transfer:</span>
                    <span className="text-yellow-400 font-bold">
                      ${amount ? (parseFloat(amount) - existingBid).toFixed(2) : '0.00'} USD
                    </span>
                  </div>
                </>
              )}
              {existingBid === 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Bid Amount:</span>
                  <span className="text-white font-semibold">${amount || '0.00'} USD</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-400">Recipient:</span>
                <span className="text-white text-xs">BidManager</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-700">
              <p className="text-xs text-zinc-500">
                💡 {existingBid > 0 ? 'Only the additional amount will be transferred from your wallet' : 'Nexus will automatically aggregate funds from all your chains'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isConnected}
            className={`w-full py-3 rounded-lg font-bold ${
              loading || !isConnected
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-white text-black hover:bg-zinc-200'
            }`}
          >
            {loading ? 'Processing...' : 'Place Bid'}
          </button>
        </form>
      </div>
    </div>
  );
}