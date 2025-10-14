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
    event BidRefunded(bytes32 indexId , address indexed Bidder);
    event WinningBidReleased(bytes32 indexed intentId, address indexed winner);

    using AuctionTypes for *;

    IAuctionHub public auctionHub;
    address public owner;
    address public keeper;

    mapping(bytes32 => mapping(address => AuctionTypes.Bid)) public lockedBids;
    mapping(bytes32 => address[]) public auctionBidders;


    modifier onlyKeeper() {
        require(msg.sender == keeper, "BidManager: Caller is not the keeper");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "BidManager: Caller is not the owner");
        _;
    }

    constructor(address _auctionHub) {
        require(_auctionHub != address(0), "Invalid auction hub address");
        auctionHub = IAuctionHub(_auctionHub);
        owner = msg.sender;
    }

    // --- Core Bidding Function ---
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

    // --- Keeper Functions ---
    
    /**
     * @notice Called by the keeper to release the winner's funds for settlement.
     * @dev This function is called after the keeper has determined the winner off-chain.
     * @dev It transfers the winning bid amount to the seller using bridgeandexecute from the SDK
     */

    function releaseWinningBid(bytes32 intentId, address winner) external onlyKeeper{
        AuctionTypes.Bid storage bid = lockedBids[intentId][winner];
        require(bid.amount > 0, "No winning bid found for this intentId");
        require(!bid.settled, "Bid already settled");

        bid.settled = true;
        IERC20(bid.token).transfer(msg.sender,bid.amount);
        emit WinningBidReleased(intentId, winner);
    }
    
     /**
     * @notice Called by the keeper to refund a losing bidder.
     */

     function refundBid(bytes32 intentId, address bidder) external onlyKeeper{
        AuctionTypes.Bid storage bid = lockedBids[intentId][bidder];
        require(bid.amount > 0, "No bid found for this intentId");
        require(!bid.settled, "Bid already settled");

        bid.settled = true;
        IERC20(bid.token).transfer(bidder, bid.amount);
        emit BidRefunded(intentId, bidder);
     }

    // --- Admin Functions --- 
    function setKeeper(address _keeper) external onlyOwner {
        require(_keeper != address(0), "Cannot set keeper to zero address");
        keeper = _keeper;
    }

}