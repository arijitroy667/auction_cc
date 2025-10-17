"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
// Calculate event signatures
const events = [
    'AuctionCancelled(bytes32)',
    'AuctionCreated(bytes32,address,address,uint256,uint256,uint256,uint256,address,uint8)',
    'AuctionCreated(bytes32,address,address,uint256,uint256,uint256,uint256,address,uint256)',
    'AuctionSettled(bytes32,address,uint256)',
    'NFTtransferred(bytes32,address,address,uint256)'
];
console.log('Event Signatures:\n');
events.forEach(event => {
    const sig = ethers_1.ethers.id(event);
    console.log(`${event}`);
    console.log(`  Signature: ${sig}\n`);
});
const actualSig = '0x9e7117a2d0faa9da9ec46146ba535a6c2ec893167cb2fc6779580b90214d7b40';
console.log(`\n🔍 Looking for: ${actualSig}`);
