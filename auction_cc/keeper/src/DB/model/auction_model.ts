import mongoose, { Schema, Document } from 'mongoose';

export interface IAuction extends Document {
  intentId: string;
  seller: string;
  nftContract: string;
  tokenId: string;
  startingPrice: string;
  reservePrice: string;
  deadline: string;
  preferdToken: string;
  preferdChain: string;
  sourceChain: string;
  status: number;
  txHash: string;
  timestamp: string;
  cancelTxHash?: string;
  cancelTimestamp?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuctionSchema: Schema = new Schema({
  intentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  seller: {
    type: String,
    required: true,
    index: true
  },
  nftContract: {
    type: String,
    required: true,
    index: true
  },
  tokenId: {
    type: String,
    required: true
  },
  startingPrice: {
    type: String,
    required: true
  },
  reservePrice: {
    type: String,
    required: true
  },
  deadline: {
    type: String,
    required: true,
    index: true
  },
  preferdToken: {
    type: String,
    required: true
  },
  preferdChain: {
    type: String,
    required: true
  },
  sourceChain: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: Number,
    required: true,
    default: 0,
    index: true
  },
  txHash: {
    type: String,
    required: true
  },
  timestamp: {
    type: String,
    required: true
  },
  cancelTxHash: {
    type: String,
    required: false
  },
  cancelTimestamp: {
    type: String,
    required: false
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'auctions'
});

// Compound indexes for better query performance
AuctionSchema.index({ status: 1, deadline: 1 });
AuctionSchema.index({ sourceChain: 1, status: 1 });
AuctionSchema.index({ seller: 1, status: 1 });

export default mongoose.model<IAuction>('Auction', AuctionSchema);