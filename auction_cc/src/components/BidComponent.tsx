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

  // Fetch highest bid for this auction (aggregated by user)
  useEffect(() => {
    const fetchHighestBid = async () => {
      setBidsLoading(true);
      try {
        const response = await fetch(`http://localhost:3001/api/bids/${auctionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data && data.data.length > 0) {
            // Aggregate bids by bidder address first
            const bidderMap = new Map<string, number>();
            
            data.data.forEach((bid: any) => {
              const bidderKey = bid.bidder.toLowerCase();
              const amount = parseFloat(ethers.formatUnits(bid.amount, 6));
              const existing = bidderMap.get(bidderKey) || 0;
              bidderMap.set(bidderKey, existing + amount);
            });
            
            // Find the highest aggregated bid
            const maxBid = Math.max(...Array.from(bidderMap.values()));
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

  // Fetch user's existing bids from the backend (aggregated across all chains)
  useEffect(() => {
    const fetchExistingBid = async () => {
      if (!isConnected || !address) return;

      try {
        console.log('=== FETCHING EXISTING BID FROM BACKEND ===');
        console.log('Auction ID:', auctionId);
        console.log('User Address:', address);
        
        // Fetch all bids for this auction from the backend
        const response = await fetch(`http://localhost:3001/api/bids/${auctionId}`);
        
        if (!response.ok) {
          console.warn('Failed to fetch bids from backend');
          setExistingBid(0);
          setExistingBidToken(null);
          return;
        }

        const data = await response.json();
        
        if (!data.success || !data.data || data.data.length === 0) {
          console.log('✓ No bids found for this auction');
          setExistingBid(0);
          setExistingBidToken(null);
          return;
        }

        // Find all bids from the current user (could be from multiple chains)
        const userBids = data.data.filter(
          (bid: any) => bid.bidder.toLowerCase() === address.toLowerCase()
        );

        if (userBids.length === 0) {
          console.log('✓ No existing bids from this user');
          setExistingBid(0);
          setExistingBidToken(null);
          return;
        }

        // Calculate total bid amount across all chains for this user
        const totalBidAmount = userBids.reduce((total: number, bid: any) => {
          // Bid amounts are stored with 6 decimals (USDC/USDT)
          const amount = parseFloat(ethers.formatUnits(bid.amount, 6));
          return total + amount;
        }, 0);

        // Get the token from the first bid (assuming user uses same token)
        const firstBidToken = userBids[0].token;

        console.log('✓ User has existing bids:');
        console.log('  - Total bids:', userBids.length);
        console.log('  - Chains:', userBids.map((b: any) => b.sourceChain).join(', '));
        console.log('  - Total amount: $' + totalBidAmount.toFixed(2));
        console.log('  - Token:', firstBidToken);

        setExistingBid(totalBidAmount);
        setExistingBidToken(firstBidToken);

      } catch (error) {
        console.error('Failed to fetch existing bid from backend:', error);
        setExistingBid(0);
        setExistingBidToken(null);
      }
    };

    fetchExistingBid();
  }, [auctionId, isConnected, address]);

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

    // Check if user is increasing an existing bid (aggregated across all chains)
    if (existingBid > 0) {
      if (newTotalBidAmount <= existingBid) {
        alert(`Your new bid must be higher than your total existing bid of $${existingBid.toFixed(2)} (across all chains)`);
        return;
      }
      
      // Note: User can bid from different chains, so we allow different tokens
      // The backend aggregates all bids by this user for this auction
      console.log('✓ Increasing existing bid from $' + existingBid.toFixed(2) + ' to $' + newTotalBidAmount.toFixed(2));
    }

    // Parse starting and reserve prices (stored as 6 decimals for USDC/USDT)
    const startingPriceNum = parseFloat(ethers.formatUnits(startingPrice, 6));
    const reservePriceNum = parseFloat(ethers.formatUnits(reservePrice, 6));

    // Validation logic for English auction (bids increase over time)
    if (highestBid === 0) {
      // First bidder: must bid at least the reserve price, up to starting price
      if (newTotalBidAmount < reservePriceNum) {
        alert(`First bid must be at least $${reservePriceNum.toFixed(2)} (reserve price)`);
        return;
      }
      if (newTotalBidAmount > startingPriceNum) {
        alert(`Bid cannot exceed $${startingPriceNum.toFixed(2)} (maximum price)`);
        return;
      }
    } else {
      // Subsequent bidders: must bid HIGHER than the current highest bid
      // and cannot exceed the starting price (maximum)
      if (newTotalBidAmount <= highestBid) {
        alert(`Your bid must be higher than the current highest bid of $${highestBid.toFixed(2)}`);
        return;
      }
      if (newTotalBidAmount > startingPriceNum) {
        alert(`Bid cannot exceed $${startingPriceNum.toFixed(2)} (maximum price)`);
        return;
      }
    }

    // Calculate the incremental amount needed
    // Round to 6 decimals to avoid floating-point precision issues
    const rawIncrementalAmount = existingBid > 0 ? newTotalBidAmount - existingBid : newTotalBidAmount;
    const incrementalAmount = Math.round(rawIncrementalAmount * 1e6) / 1e6;

    if (incrementalAmount > unifiedBalance) {
      alert(`Insufficient balance. You need $${incrementalAmount.toFixed(2)} more, but only have $${unifiedBalance.toFixed(2)} ${selectedToken} available across all chains.`);
      return;
    }

    try {
      setLoading(true);

      console.log('=== BID SUBMISSION STARTED ===');
      console.log('Auction ID:', auctionId);
      console.log('Connected Address:', address);
      console.log('Selected Chain:', selectedChain, CHAIN_NAMES[selectedChain as keyof typeof CHAIN_NAMES]);
      console.log('Total Bid Amount:', newTotalBidAmount, selectedToken);
      console.log('Existing Bid:', existingBid);
      console.log('Incremental Amount to Transfer:', incrementalAmount, selectedToken);
      console.log('BidManager Address:', BID_MANAGER_ADDRESS);

      // Get the token address early for verification
      const tokenAddress = TOKEN_ADDRESSES[selectedChain as keyof typeof TOKEN_ADDRESSES][selectedToken];
      if (!tokenAddress) {
        throw new Error(`Token address not found for ${selectedToken} on chain ${selectedChain}`);
      }
      console.log('Token Address:', tokenAddress);

      console.log('\n=== STEP 1: NEXUS TRANSFER ===');
      // Use Nexus SDK transfer - only transfer the incremental amount needed
      // It will automatically aggregate tokens from all chains
      const transferResult = await nexusTransfer(
        selectedToken,        // token symbol (USDC or USDT)
        incrementalAmount,   // only transfer the additional amount needed
        selectedChain,       // target chainId where BidManager will receive funds
        BID_MANAGER_ADDRESS, // recipient address (BidManager contract)
        undefined            // sourceChains - let SDK auto-select from available balances
      );

      console.log('Nexus transfer result:', transferResult);

      if (!transferResult || !transferResult.success) {
        throw new Error('Nexus transfer failed or was not completed');
      }

      console.log('\n=== STEP 2: WAITING FOR CONFIRMATION ===');
      // After successful transfer, the tokens are now on the target chain at BidManager
      console.log(`Tokens transferred to BidManager (${incrementalAmount} ${selectedToken})`);
      
      // Wait for the transfer to be confirmed and indexed
      console.log('Waiting 15 seconds for blockchain confirmation...');
      await new Promise(resolve => setTimeout(resolve, 15000));

      console.log('\n=== STEP 3: VERIFYING BALANCE ===');
      // Create a provider for verification and later transaction
      const provider = new ethers.BrowserProvider(walletClient as any);
      
      // Check BidManager contract balance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );

      const bidManagerBalance = await tokenContract.balanceOf(BID_MANAGER_ADDRESS);
      console.log(`✓ BidManager balance: ${ethers.formatUnits(bidManagerBalance, 6)} ${selectedToken}`);

      // Format the amount to exactly 6 decimal places to avoid precision issues
      const formattedAmount = incrementalAmount.toFixed(6);
      const expectedAmount = ethers.parseUnits(formattedAmount, 6);
      console.log(`✓ Expected transfer amount: ${formattedAmount} ${selectedToken}`);

      if (bidManagerBalance < expectedAmount) {
        console.warn('⚠️ Warning: BidManager balance is less than expected amount!');
        console.warn('This might cause the placeBid transaction to fail.');
        console.warn('Continuing anyway - the smart contract will verify...');
      }

      console.log('\n=== STEP 4: CALLING PLACEBID ===');
      // Now we call placeBid on the BidManager contract
      console.log('Preparing placeBid transaction...');

      // Convert the INCREMENTAL amount to wei (assuming 6 decimals for USDC/USDT)
      // Use the same formatted amount to ensure consistency
      const amountInWei = ethers.parseUnits(formattedAmount, 6);
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
                    ${parseFloat(ethers.formatUnits(reservePrice, 6)).toFixed(2)} - ${parseFloat(ethers.formatUnits(startingPrice, 6)).toFixed(2)}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    First bidders must bid between reserve and starting price
                  </p>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span>Current Highest Bid:</span>
                    <span className="text-lg font-bold text-green-400">${highestBid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span>Your Bid Range:</span>
                    <span className="text-sm text-white">${(highestBid + 0.01).toFixed(2)} - ${parseFloat(ethers.formatUnits(startingPrice, 6)).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    English Auction: Bid higher than the current highest bid
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Existing Bid Display (if user has one) */}
          {existingBid > 0 && (
            <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
              <div className="flex justify-between items-center">
                <span className="text-sm text-zinc-400">Your Total Bid (All Chains):</span>
                <span className="text-lg font-bold text-yellow-400">${existingBid.toFixed(2)}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                💡 You can increase your bid. Only the additional amount will be transferred.
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                🔗 Your bids are aggregated across all chains where you've placed them
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