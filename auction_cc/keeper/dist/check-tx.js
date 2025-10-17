"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
async function checkTransaction() {
    const provider = new ethers_1.ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/6y-qIXrvCT6NLMi6WDWeJ');
    const txHash = '0xc8baabf9f2bbd5e5cf090ba871067fd4ca2361893f83c4ed26cd1f8169e60278';
    try {
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
            console.log('Transaction not found');
            return;
        }
        console.log('Transaction Status:', receipt.status === 1 ? 'Success ✅' : 'Failed ❌');
        console.log('To Address:', receipt.to);
        console.log('From Address:', receipt.from);
        console.log('Block Number:', receipt.blockNumber);
        console.log('Logs Count:', receipt.logs.length);
        console.log('\n📋 Event Logs:');
        receipt.logs.forEach((log, i) => {
            console.log(`\nLog ${i}:`);
            console.log('  Contract Address:', log.address);
            console.log('  Topics[0] (Event Sig):', log.topics[0]);
            if (log.topics[1])
                console.log('  Topics[1]:', log.topics[1]);
        });
        // Check if it matches our expected contract
        const expectedAddress = '0x003b0C383aFF1C5a08073fB8e5e704818313Ee95';
        const matchingLogs = receipt.logs.filter(log => log.address.toLowerCase() === expectedAddress.toLowerCase());
        console.log('\n🔍 Analysis:');
        console.log(`Expected AuctionHub Address: ${expectedAddress}`);
        console.log(`Logs from AuctionHub: ${matchingLogs.length}`);
        if (matchingLogs.length === 0) {
            console.log('\n⚠️  NO LOGS FROM AUCTION HUB CONTRACT!');
            console.log('This means the transaction did not interact with the AuctionHub contract.');
            console.log('Possible issues:');
            console.log('  1. Wrong contract address in config');
            console.log('  2. Transaction went to a different contract');
            console.log('  3. Frontend using a different AuctionHub address');
        }
        else {
            console.log('\n✅ Transaction interacted with AuctionHub!');
            console.log('Event signature:', matchingLogs[0].topics[0]);
            // AuctionCreated event signature
            const auctionCreatedSig = '0xf10110b3e421e8b2dc05974b8c3d341e9864acd0e09c9d6d382761cfcc9a504a';
            if (matchingLogs[0].topics[0] === auctionCreatedSig) {
                console.log('✅ AuctionCreated event detected!');
            }
        }
    }
    catch (error) {
        console.error('Error:', error.message);
    }
}
checkTransaction();
