// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAuctionHub} from "./Interfaces/IAuctionHub.sol";
import {AuctionTypes} from "./AuctionTypes.sol";

contract BidManager {
    event BidPlaced(
        bytes32 indexed intentId,
        address indexed bidder,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

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
        require(amount >= auction.startingPrice, "Bid amount below starting price"); // MODIFIED: Check starting price
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        AuctionTypes.Bid storage bid = lockedBids[intentId][msg.sender];
        if (bid.amount > 0) {
            IERC20(bid.token).transfer(msg.sender, bid.amount);
        } else {
            auctionBidders[intentId].push(msg.sender);
        }

        bid.intentId = intentId;
        bid.bidder = msg.sender;
        bid.token = token;
        bid.amount = amount;
        bid.timestamp = block.timestamp;
        bid.settled = false;

        emit BidPlaced(intentId, msg.sender, token, amount, block.timestamp);
        return true;
    }

    //refundBid
}