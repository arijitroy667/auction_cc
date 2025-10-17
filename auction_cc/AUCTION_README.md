# Cross-Chain Auction System

A decentralized auction platform that allows users to create and participate in NFT auctions across multiple blockchain networks.

## Features

- **Cross-chain NFT Auctions**: Create auctions that accept bids from multiple blockchains
- **Supported Tokens**: USDT, USDC, and DAI across Ethereum, Polygon, Arbitrum, and Base
- **Nexus Integration**: Seamless cross-chain user experience
- **Real-time Auction Management**: Create, view, and manage auctions through a modern web interface

## Supported Networks

- **Ethereum** (Chain ID: 1)
- **Polygon** (Chain ID: 137)
- **Arbitrum** (Chain ID: 42161)
- **Base** (Chain ID: 8453)

## Supported Tokens

### USDT
- Ethereum: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- Polygon: `0xc2132D05D31c914a87C6611C10748AEb04B58e8F`
- Arbitrum: `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9`
- Base: `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2`

### USDC
- Ethereum: `0xA0b86a33E6441b89FE9d4C5D96078DE6Ee51b846`
- Polygon: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
- Arbitrum: `0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8`
- Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

### DAI
- Ethereum: `0x6B175474E89094C44Da98b954EedeAC495271d0F`
- Polygon: `0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063`
- Arbitrum: `0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1`
- Base: `0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb`

## Smart Contract

**AuctionHub Contract Address**: `0x09690941A1Bef2822DC5814a49aFAb14168aC0B2`

## Setup and Installation

### Prerequisites

- Node.js 18+
- pnpm
- A Web3 wallet (MetaMask, etc.)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd auction_cc
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Creating an Auction

1. **Connect Wallet**: Click the "Connect Wallet" button and connect your Web3 wallet
2. **Initialize Nexus**: Click "Initialize Nexus" to enable cross-chain functionality
3. **Navigate to Create**: Go to the "Create Auction" page
4. **Fill Auction Details**:
   - **NFT Contract Address**: Enter the contract address of your NFT
   - **Token ID**: Enter the specific token ID you want to auction
   - **Starting Price**: Set the minimum bid amount (in ETH equivalent)
   - **Reserve Price**: (Optional) Set a minimum selling price
   - **Duration**: Choose how long the auction should run
   - **Preferred Token**: Select from USDT, USDC, or DAI
   - **Preferred Chain**: Choose the blockchain network

5. **Approve NFT Transfer**: Before creating the auction, you'll need to approve the AuctionHub contract to transfer your NFT
6. **Create Auction**: Click "Create Auction" to submit the transaction

### Before Creating an Auction

**Important**: You must approve the AuctionHub contract to transfer your NFT before creating an auction. You can do this by calling the `approve` or `setApprovalForAll` function on your NFT contract with the AuctionHub address: `0x09690941A1Bef2822DC5814a49aFAb14168aC0B2`

### Viewing Auctions

- Navigate to the "Auctions" page to view all active auctions
- Filter auctions by token type, chain, or status
- View detailed auction information including current highest bid, time remaining, and seller details

## Technical Architecture

### Frontend
- **Next.js 15**: React framework with App Router
- **Wagmi**: React hooks for Ethereum
- **RainbowKit**: Wallet connection interface
- **Nexus**: Cross-chain integration
- **Ethers.js**: Ethereum library for contract interactions
- **TailwindCSS**: Utility-first CSS framework

### Smart Contracts
- **AuctionHub.sol**: Main auction management contract
- **AuctionTypes.sol**: Data structures and enums
- **BidManager.sol**: Cross-chain bid management

### Key Files
- `src/lib/auctionHub.ts`: Contract interaction utilities
- `src/lib/constants.ts`: Token addresses and chain configurations
- `src/abis/AuctionHub.json`: Contract ABI
- `src/app/create/page.tsx`: Auction creation interface

## Contract Functions

### Core Functions
- `createAuction()`: Create a new auction
- `cancelAuction()`: Cancel an auction (only if no bids)
- `getAuction()`: Retrieve auction details
- `getSellerAuctions()`: Get all auctions by a seller

### Keeper Functions (Admin Only)
- `finalizeAuction()`: Set the auction winner
- `NFTrelease()`: Transfer NFT to the winner

## Events

- `AuctionCreated`: Emitted when a new auction is created
- `AuctionCancelled`: Emitted when an auction is cancelled
- `AuctionSettled`: Emitted when an auction is finalized
- `NFTtransferred`: Emitted when NFT is transferred to winner

## Security Considerations

1. **NFT Ownership**: Ensure you own the NFT before creating an auction
2. **Contract Approval**: Only approve the official AuctionHub contract
3. **Token Selection**: Only use the supported stablecoins (USDT, USDC, DAI)
4. **Network Verification**: Verify you're on the correct network before transactions

## Support

For technical support or questions about the auction system, please refer to the smart contract documentation or contact the development team.

## License

MIT License - see LICENSE file for details