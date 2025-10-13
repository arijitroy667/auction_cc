// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

/**
 * @title AuctionTypes
 * @dev Library containing all structs and enums used across the auction system
 */
library AuctionTypes {
    /**
     * @dev Enum representing the different states of an auction
     */
    enum AuctionStatus {
        Created,
        Active,
        Finalized,
        Settled,
        Cancelled
    }

    /**
     * @dev Struct representing an auction
     * @param intentId Unique identifier for the auction
     * @param seller Address of the auction seller
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT being auctioned
     * @param startingPrice Minimum starting bid price
     * @param reservePrice Minimum acceptable final price
     * @param deadline Unix timestamp when the auction ends
     * @param preferdToken Preferred ERC20 token for payments
     * @param preferdChain Preferred chain ID for the auction
     * @param highestBidder Address of the current highest bidder
     * @param highestBid Current highest bid amount
     * @param status Current status of the auction
     */
    struct Auction {
        bytes32 intentId;
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 startingPrice;
        uint256 reservePrice;
        uint256 deadline;
        address preferdToken;
        uint8 preferdChain;
        address highestBidder;
        uint256 highestBid;
        AuctionStatus status;
    }

    /**
     * @dev Struct representing a bid in the auction system
     * @param intentId Unique identifier for the auction this bid belongs to
     * @param bidder Address of the person placing the bid
     * @param token Address of the ERC20 token used for the bid
     * @param amount Amount of tokens bid
     * @param timestamp Unix timestamp when the bid was placed
     * @param settled Whether the bid has been settled/processed
     */
    struct Bid {
        bytes32 intentId;
        address bidder;
        address token;
        uint256 amount;
        uint256 timestamp;
        bool settled;
    }
}