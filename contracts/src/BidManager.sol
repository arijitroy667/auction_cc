// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IAuctionHub} from "./Interfaces/IAuctionHub.sol";
import {AuctionTypes} from "./AuctionTypes.sol";

contract BidManager {
    using AuctionTypes for *;

    IAuctionHub public auctionHub;

    mapping(bytes32 => mapping(address => AuctionTypes.Bid)) public lockedBids;
    mapping(bytes32 => address[]) public auctionBidders;

    constructor(address _auctionHub) {
        require(_auctionHub != address(0), "Invalid auction hub address");
        auctionHub = IAuctionHub(_auctionHub);
    }

    function placeBid(
        bytes32 intentId,
        address token,
        uint256 amount
    ) external returns (bool){
        AuctionTypes.Auction memory auction = auctionHub.getAuction(intentId);
        require(auction.status == AuctionTypes.AuctionStatus.Active, "Auction is not active");
        require(block.timestamp < auction.deadline, "Auction has ended");
        require(amount >= auction.reservePrice, "Bid amount below reserve price");

        AuctionTypes.Bid bid = AuctionTypes.Bid({
            intentId: intentId,
            bidder: msg.sender,
            token: token,
            amount: amount,
            timestamp: block.timestamp,
            settled: false
        });

        lockedBids[intentId][msg.sender] = bid;
        auctionBidders[intentId].push(msg.sender);

        emit BidPlaced(intentId, msg.sender, token, amount, block.timestamp);
        return true;
    }
}