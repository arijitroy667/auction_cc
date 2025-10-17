import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';

interface BidFormProps {
  auctionId: string;
  startingPrice: string;
  onBidSubmit: (amount: string) => Promise<void>;
  onClose: () => void;
}

export default function BidForm({ auctionId, startingPrice, onBidSubmit, onClose }: BidFormProps) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const { isConnected } = useAccount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      await onBidSubmit(amount);
      onClose();
    } catch (error) {
      console.error('Bid failed:', error);
      alert('Failed to place bid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Place Bid</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Bid Amount (ETH)</label>
            <input
              type="number"
              step="0.000000000000000001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-black border border-zinc-800 text-white"
              placeholder="Enter amount in ETH"
              min={ethers.formatEther(startingPrice)}
              required
            />
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