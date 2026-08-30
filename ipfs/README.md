# IPFS Upload Scripts

Two Node.js scripts for uploading game card assets and metadata to IPFS
via [nft.storage](https://nft.storage).

## Setup

```bash
cd ipfs/
cp .env.example .env          # add your NFT_STORAGE_API_KEY
npm install
```

## Scripts

### 1. `uploadAsset.js` — Upload an image

```bash
node ipfs/uploadAsset.js <path-to-image>

# Example
node ipfs/uploadAsset.js ./assets/dragon.png
# Output (stdout): ipfs://bafyrei...
```

### 2. `createMetadata.js` — Build & upload ERC-721 metadata

```bash
node ipfs/createMetadata.js <name> <description> <imageCID> <rarity> [key=value ...]

# Example
node ipfs/createMetadata.js \
  "Dragon Slayer" \
  "A legendary fire-type card with devastating attack power." \
  "ipfs://bafyrei..." \
  "Legendary" \
  "Attack=850" \
  "Defense=320" \
  "Speed=610"

# Output (stdout): ipfs://bafyrei...<metadataCID>
```

## Typical workflow

```bash
# Step 1 – upload the card artwork
IMAGE_CID=$(node ipfs/uploadAsset.js ./assets/dragon.png)
echo "Image CID: $IMAGE_CID"

# Step 2 – create and upload metadata that references the image
META_CID=$(node ipfs/createMetadata.js \
  "Dragon Slayer" \
  "A legendary fire-type card." \
  "$IMAGE_CID" \
  "Legendary" \
  "Attack=850")
echo "Metadata CID: $META_CID"

# Step 3 – mint the NFT with the metadata URI
# In your frontend or Hardhat script:
#   await marketplace.mintCard(META_CID);
```

## Metadata format (ERC-721 / OpenSea)

```json
{
  "name": "Dragon Slayer",
  "description": "A legendary fire-type card with devastating attack power.",
  "image": "ipfs://bafyrei...",
  "external_url": "https://your-marketplace-domain.com",
  "background_color": "0d0d0d",
  "attributes": [
    { "trait_type": "Rarity",       "value": "Legendary" },
    { "display_type": "number", "trait_type": "Rarity Power", "value": 5 },
    { "display_type": "number", "trait_type": "Attack",       "value": 850 }
  ]
}
```

## Environment variables

| Variable              | Description                                     |
|-----------------------|-------------------------------------------------|
| `NFT_STORAGE_API_KEY` | API token from [nft.storage](https://nft.storage) |

> **Note:** nft.storage deprecated their legacy free service in June 2024 and
> moved to a new model. If the API key approach changes, consider switching to
> [Pinata](https://pinata.cloud) or [web3.storage](https://web3.storage).