// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/AuctionHub.sol";
import "../src/BidManager.sol";

contract Deploy is Script {
    bytes32 constant SALT_AUCTION = keccak256("AUCTION_V7");
    bytes32 constant SALT_BID = keccak256("BID_V7");

    function run() external {
        vm.startBroadcast();

        address deployer = msg.sender;

        AuctionHub auction = new AuctionHub{salt: SALT_AUCTION}(deployer);
        BidManager bidManager = new BidManager{salt: SALT_BID}(deployer);

        console.log("AuctionHub deployed at:", address(auction));
        console.log("BidManager deployed at:", address(bidManager));
        console.log("Owner set to:", deployer);

        vm.stopBroadcast();
    }
}
