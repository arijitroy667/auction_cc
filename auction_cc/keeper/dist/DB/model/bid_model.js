"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const BidSchema = new mongoose_1.Schema({
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
exports.default = mongoose_1.default.model('Bid', BidSchema);
