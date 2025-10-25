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
const AuctionSchema = new mongoose_1.Schema({
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
    timestamps: true,
    collection: 'auctions'
});
AuctionSchema.index({ status: 1, deadline: 1 });
AuctionSchema.index({ sourceChain: 1, status: 1 });
AuctionSchema.index({ seller: 1, status: 1 });
exports.default = mongoose_1.default.model('Auction', AuctionSchema);
