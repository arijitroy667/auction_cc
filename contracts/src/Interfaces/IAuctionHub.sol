// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import {AuctionTypes} from "../AuctionTypes.sol";

/**
 * @title IAuctionHub
 * @dev Interface for the AuctionHub contract
 */
interface IAuctionHub {
    // Events
    event AuctionCreated(
        bytes32 indexed intentId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 deadline,
        address preferdToken,
        uint256 preferdChain
    );
    
    event AuctionCancelled(bytes32 indexed intentId);

    // Functions
    /**
     * @dev Creates a new auction for an NFT
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT
     * @param startingPrice Starting price for the auction
     * @param reservePrice Reserve price for the auction
     * @param deadline Auction deadline timestamp
     * @param preferdToken Preferred token address for payments
     * @param preferdChain Preferred chain ID for the auction
     * @return intentId The unique identifier for the created auction
     */
    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 deadline,
        address preferdToken,
        uint256 preferdChain
    ) external returns (bytes32);

    /**
     * @dev Cancels an active auction
     * @param intentId The unique identifier of the auction to cancel
     */
    function cancelAuction(bytes32 intentId) external;

    /**
     * @dev Retrieves auction details
     * @param intentId The unique identifier of the auction
     * @return auction The auction struct containing all details
     */
    function getAuction(bytes32 intentId) external view returns (AuctionTypes.Auction memory);

    /**
     * @dev Retrieves all auction IDs for a specific seller
     * @param seller Address of the seller
     * @return Array of auction intent IDs
     */
    function getSellerAuctions(address seller) external view returns (bytes32[] memory);

    /**
     * @dev Retrieves all auction intent IDs
     * @return Array of all intent IDs (as uint256)
     */
    function getAllIntentIds() external view returns (uint256[] memory);

    // View functions for mappings
    /**
     * @dev Gets auction data from mapping
     * @param intentId The auction intent ID
     * @return The auction struct
     */
    function auctions(bytes32 intentId) external view returns (
        bytes32,
        address,
        address,
        uint256,
        uint256,
        uint256,
        uint256,
        address,
        uint256,
        address,
        uint256,
        AuctionTypes.AuctionStatus
    );
}