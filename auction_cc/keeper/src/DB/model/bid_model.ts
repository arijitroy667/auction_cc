import mongoose, { Schema, Document } from 'mongoose';

export interface IBid extends Document {
  intentId: string;
  bidder: string;
  amount: string;
  token: string;
  sourceChain: string;
  transactionHash: string;
  timestamp: string;
  createdAt: Date;
  updatedAt: Date;
}

const BidSchema: Schema = new Schema({
  intentId: {
    type: String,
    required: true,
    index: true
  },
  bidder: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: String,
    required: true
  },
  token: {
    type: String,
    required: true,
    index: true
  },
  sourceChain: {
    type: String,
    required: true,
    index: true
  },
  transactionHash: {
    type: String,
    required: true,
    unique: true // ✅ Each transaction hash must be unique
  },
  timestamp: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  collection: 'bids'
});

// ✅ UPDATED: Better indexes for querying
BidSchema.index({ intentId: 1, bidder: 1 }); // For aggregating bids by bidder
BidSchema.index({ intentId: 1, timestamp: 1 }); // For chronological order
BidSchema.index({ bidder: 1, sourceChain: 1 }); // For bidder's history

export default mongoose.model<IBid>('Bid', BidSchema);