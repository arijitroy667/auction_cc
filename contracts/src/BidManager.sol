// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAuctionHub} from "./Interfaces/IAuctionHub.sol";
import {AuctionTypes} from "./AuctionTypes.sol";

contract BidManager is ReentrancyGuard {
    event BidPlaced(
        bytes32 indexed intentId,
        address indexed bidder,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    event BidRefunded(bytes32 indexId, address indexed Bidder);
    event WinningBidReleased(bytes32 indexed intentId, address indexed winner);

    using AuctionTypes for *;
    using SafeERC20 for IERC20;

    IAuctionHub public auctionHub;
    address public owner;
    address public keeper;

    mapping(bytes32 => mapping(address => AuctionTypes.Bid)) public lockedBids;
    mapping(bytes32 => address[]) public auctionBidders;
    
    // Track expected token balance per intentId to verify Nexus transfers
    mapping(bytes32 => uint256) private expectedBalance;

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
    /**
     * @notice Place a bid after tokens have been transferred via Nexus SDK
     * @dev User must have already sent tokens to this contract via Nexus bridgeAndExecute
     * @param intentId The auction intent ID
     * @param token The token address on this chain
     * @param amount The INCREMENTAL bid amount (must match what was transferred)
     *               For new bids: full amount
     *               For existing bids: only the additional amount being added
     */
    function placeBid(
        bytes32 intentId,
        address token,
        uint256 amount
    ) external nonReentrant returns (bool) {
        AuctionTypes.Auction memory auction = auctionHub.getAuction(intentId);
        require(auction.status == AuctionTypes.AuctionStatus.Active, "Auction is not active");
        require(block.timestamp < auction.deadline, "Auction has ended");
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");

        AuctionTypes.Bid storage bid = lockedBids[intentId][msg.sender];

        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        uint256 expectedMinBalance = expectedBalance[intentId] + amount;
        require(contractBalance >= expectedMinBalance, "Tokens not received - transfer via Nexus first");

        if (bid.amount > 0) {
            require(bid.token == token, "Token mismatch for existing bid");
            bid.amount += amount; 
            bid.timestamp = block.timestamp;
        } else {
            require(amount >= auction.reservePrice, "Bid amount below reserve price");
            auctionBidders[intentId].push(msg.sender);
            bid.intentId = intentId;
            bid.bidder = msg.sender;
            bid.amount = amount;
            bid.token = token;
            bid.timestamp = block.timestamp;
            bid.settled = false;
        }
        expectedBalance[intentId] += amount;

        emit BidPlaced(intentId, msg.sender, token, amount, block.timestamp);
        return true;
    }

    // --- Keeper Functions ---
    /**
     * @notice Release winning bid to the seller
     */
    function releaseWinningBid(bytes32 intentId, address winner) external onlyKeeper nonReentrant {
        AuctionTypes.Bid storage bid = lockedBids[intentId][winner];
        require(bid.amount > 0, "No winning bid found");
        require(!bid.settled, "Bid already settled");

        AuctionTypes.Auction memory auction = auctionHub.getAuction(intentId);
        require(auction.seller != address(0), "Invalid seller address");

        bid.settled = true;
        expectedBalance[intentId] -= bid.amount;
        
        // Transfer to seller (not keeper)
        IERC20(bid.token).safeTransfer(auction.seller, bid.amount);
        emit WinningBidReleased(intentId, winner);
    }
    
    /**
     * @notice Refund a losing bidder
     */
    function refundBid(bytes32 intentId, address bidder) external onlyKeeper nonReentrant {
        AuctionTypes.Bid storage bid = lockedBids[intentId][bidder];
        require(bid.amount > 0, "No bid found");
        require(!bid.settled, "Bid already settled");

        bid.settled = true;
        expectedBalance[intentId] -= bid.amount;
        
        IERC20(bid.token).safeTransfer(bidder, bid.amount);
        emit BidRefunded(intentId, bidder);
    }

    // --- Admin Functions ---
    function setKeeper(address _keeper) external onlyOwner {
        require(_keeper != address(0), "Cannot set keeper to zero address");
        keeper = _keeper;
    }

    // Emergency function to recover stuck tokens
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner, amount);
    }
}