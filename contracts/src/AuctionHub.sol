// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AuctionTypes} from "./AuctionTypes.sol";

contract AuctionHub {
    using AuctionTypes for *;

    event AuctionCreated(
        bytes32 indexed intentId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 deadline,
        address preferdToken,
        uint8 preferdChain
    );
    event AuctionCancelled(bytes32 indexed intentId);

    mapping(bytes32 => AuctionTypes.Auction) public auctions;
    mapping(bytes32 => AuctionTypes.Bid[]) public auctionBids;
    mapping(address => bytes32[]) public sellerAuctions;
    uint256[] public allIntentsIds;

    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 reservePrice,
        uint256 deadline,
        address preferdToken,
        uint8 preferdChain
    ) external returns (bytes32) {
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(IERC721(nftContract).ownerOf(tokenId) == msg.sender, "Not the NFT owner");

        bytes32 intentId = keccak256(abi.encodePacked(msg.sender, nftContract, tokenId, block.timestamp));

        require(auctions[intentId].seller == address(0), "Auction already exists");


        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);

        auctions[intentId] = AuctionTypes.Auction({
            intentId: intentId,
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            startingPrice: startingPrice,
            reservePrice: reservePrice,
            deadline: deadline,
            preferdToken: preferdToken,
            preferdChain: preferdChain,
            highestBidder: address(0),
            highestBid: 0,
            status: AuctionTypes.AuctionStatus.Active
        });

        sellerAuctions[msg.sender].push(intentId);
        allIntentsIds.push(uint256(intentId));

        emit AuctionCreated(intentId, msg.sender, nftContract, tokenId, startingPrice, reservePrice, deadline, preferdToken, preferdChain);

        return intentId;
    }

    function cancelAuction(bytes32 intentId) external {
        AuctionTypes.Auction storage auction = auctions[intentId];
        require(auction.seller == msg.sender, "Not the seller");
        require(auction.status == AuctionTypes.AuctionStatus.Active, "Auction not active");
        require(auction.highestBid == 0, "Cannot cancel with bids");
        require(block.timestamp < auction.deadline, "Auction ended");

        auction.status = AuctionTypes.AuctionStatus.Cancelled;
        IERC721(auction.nftContract).transferFrom(address(this), auction.seller, auction.tokenId);

        emit AuctionCancelled(intentId);
    }

    function getAuction(bytes32 intentId) external view returns (AuctionTypes.Auction memory) {
        return auctions[intentId];
    }

    function getSellerAuctions(address seller) external view returns (bytes32[] memory) {
        return sellerAuctions[seller];
    }

    function getAllIntentIds() external view returns (uint256[] memory) {
        return allIntentsIds;
    }
}