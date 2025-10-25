import { ethers } from "ethers";

export interface NFTMetadata {
  contractAddress: string;
  tokenId: string;
  name: string;
  image: string;
  description?: string;
  collectionName?: string;
}

const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
];

const ERC721_ENUMERABLE_INTERFACE_ID = "0x780e9d63";


async function fetchTokenMetadata(tokenURI: string): Promise<any> {
  try {
    let url = tokenURI;
    if (tokenURI.startsWith("ipfs://")) {
      url = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }

    const metadata = await response.json();
    return metadata;
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return null;
  }
}

/**
 * Fetch NFTs owned by a user using direct contract calls
 * This works for ERC721Enumerable contracts
 */
export async function fetchUserNFTsFromContract(
  contractAddress: string,
  userAddress: string,
  provider: ethers.Provider
): Promise<NFTMetadata[]> {
  try {
    const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

    let supportsEnumerable = false;
    try {
      supportsEnumerable = await contract.supportsInterface(
        ERC721_ENUMERABLE_INTERFACE_ID
      );
    } catch (error) {
      console.log("Contract does not support supportsInterface");
    }

    if (!supportsEnumerable) {
      throw new Error(
        "Contract does not support ERC721Enumerable. Please use an API service instead."
      );
    }

    const balance = await contract.balanceOf(userAddress);
    const nfts: NFTMetadata[] = [];

    // Get collection name
    let collectionName = "Unknown Collection";
    try {
      collectionName = await contract.name();
    } catch (error) {
      console.log("Could not fetch collection name");
    }

    // Fetch each NFT
    for (let i = 0; i < Number(balance); i++) {
      try {
        const tokenId = await contract.tokenOfOwnerByIndex(userAddress, i);
        const tokenURI = await contract.tokenURI(tokenId);

        // Fetch metadata
        const metadata = await fetchTokenMetadata(tokenURI);

        let image = metadata?.image || "";
        if (image.startsWith("ipfs://")) {
          image = image.replace("ipfs://", "https://ipfs.io/ipfs/");
        }

        nfts.push({
          contractAddress,
          tokenId: tokenId.toString(),
          name: metadata?.name || `Token #${tokenId}`,
          image,
          description: metadata?.description,
          collectionName,
        });
      } catch (error) {
        console.error(`Error fetching token ${i}:`, error);
      }
    }

    return nfts;
  } catch (error) {
    console.error("Error fetching NFTs from contract:", error);
    throw error;
  }
}


export async function fetchUserNFTsFromAlchemy(
  userAddress: string,
  chainId: number,
  alchemyApiKey?: string
): Promise<NFTMetadata[]> {
  if (!alchemyApiKey) {
    console.warn("Alchemy API key not provided");
    return [];
  }

  try {
    const networkMap: { [key: number]: string } = {
      1: "eth-mainnet",
      11155111: "eth-sepolia",
      42161: "arb-mainnet",
      421614: "arb-sepolia",
      10: "opt-mainnet",
      11155420: "opt-sepolia",
      8453: "base-mainnet",
      84532: "base-sepolia",
    };

    const network = networkMap[chainId];
    if (!network) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const url = `https://${network}.g.alchemy.com/nft/v3/${alchemyApiKey}/getNFTsForOwner?owner=${userAddress}&withMetadata=true&pageSize=100`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alchemy API error: ${response.statusText}`);
    }

    const data = await response.json();

    const nfts: NFTMetadata[] = data.ownedNfts.map((nft: any) => {
      let image = nft.image?.cachedUrl || nft.image?.originalUrl || "";
      
      // Handle IPFS URLs
      if (image.startsWith("ipfs://")) {
        image = image.replace("ipfs://", "https://ipfs.io/ipfs/");
      }

      return {
        contractAddress: nft.contract.address,
        tokenId: nft.tokenId,
        name: nft.name || nft.title || `Token #${nft.tokenId}`,
        image,
        description: nft.description,
        collectionName: nft.contract.name || "Unknown Collection",
      };
    });

    return nfts;
  } catch (error) {
    console.error("Error fetching NFTs from Alchemy:", error);
    throw error;
  }
}

