#!/usr/bin/env node
/**
 * createMetadata.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds an ERC-721-compliant metadata JSON document for a game card, uploads
 * it to IPFS via nft.storage, and prints the resulting content URI.
 *
 * Usage:
 *   node ipfs/createMetadata.js <name> <description> <imageCID> <rarity> [extraAttributes...]
 *
 * Positional arguments:
 *   name         – Card name,              e.g. "Dragon Slayer"
 *   description  – Card description,       e.g. "A rare fire-type card"
 *   imageCID     – Image IPFS URI,         e.g. "ipfs://bafyrei..."
 *   rarity       – Rarity tier,            e.g. "Legendary"
 *
 * Optional extra attributes (pairs of trait_type=value):
 *   node ipfs/createMetadata.js "Dragon Slayer" "..." "ipfs://..." "Legendary" "Attack=450" "Defense=220"
 *
 * Examples:
 *   node ipfs/createMetadata.js "Dragon Slayer" "A rare card" "ipfs://bafyrei..." "Legendary"
 *   node ipfs/createMetadata.js "Iron Shield"  "A common card" "ipfs://Qm..."    "Common" "Defense=500"
 *
 * Environment variables (place in ipfs/.env or export before running):
 *   NFT_STORAGE_API_KEY  – your nft.storage API token
 *
 * Output (stdout):
 *   ipfs://<metadataCID>
 *
 * ERC-721 Metadata JSON Schema reference:
 *   https://eips.ethereum.org/EIPS/eip-721
 *   https://docs.opensea.io/docs/metadata-standards
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NFTStorage, Blob } from "nft.storage";
import { resolve } from "path";
import * as dotenv from "dotenv";

// Load .env from the ipfs/ directory first, then fall back to project root.
dotenv.config({ path: new URL(".env", import.meta.url).pathname });
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

// ── Constants ─────────────────────────────────────────────────────────────────

/** Supported rarity tiers for validation. */
const RARITY_TIERS = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

/** Map rarity → numeric power score (surfaced as an attribute). */
const RARITY_POWER = {
  Common:    1,
  Uncommon:  2,
  Rare:      3,
  Epic:      4,
  Legendary: 5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function usage() {
  console.error(`
Usage:
  node ipfs/createMetadata.js <name> <description> <imageCID> <rarity> [key=value ...]

Arguments:
  name         Card name              (e.g. "Dragon Slayer")
  description  Card description       (e.g. "A legendary fire card")
  imageCID     IPFS image URI         (e.g. "ipfs://bafyrei...")
  rarity       One of: ${RARITY_TIERS.join(" | ")}
  key=value    Extra attributes       (e.g. Attack=450 Defense=220)

Example:
  node ipfs/createMetadata.js "Dragon Slayer" "A rare card" "ipfs://bafyrei..." "Legendary"
  node ipfs/createMetadata.js "Iron Shield"   "A common card" "ipfs://Qm..." "Common" "Defense=500" "Speed=80"

Required env:
  NFT_STORAGE_API_KEY=<your-token>
`);
  process.exit(1);
}

function validate() {
  const apiKey = process.env.NFT_STORAGE_API_KEY;
  if (!apiKey || apiKey === "your_nft_storage_api_key_here") {
    console.error("❌  NFT_STORAGE_API_KEY is not set.");
    console.error("    Get a free API key at https://nft.storage");
    process.exit(1);
  }

  const [, , name, description, imageCID, rarity, ...extras] = process.argv;

  if (!name || !description || !imageCID || !rarity) {
    console.error("❌  Missing required arguments.");
    usage();
  }

  if (!imageCID.startsWith("ipfs://") && !imageCID.startsWith("https://")) {
    console.error(`❌  imageCID must start with "ipfs://" or "https://". Got: ${imageCID}`);
    process.exit(1);
  }

  if (!RARITY_TIERS.includes(rarity)) {
    console.error(`❌  Unknown rarity "${rarity}". Valid values: ${RARITY_TIERS.join(", ")}`);
    process.exit(1);
  }

  // Parse optional extra attributes from  Key=Value  format
  const extraAttributes = extras
    .filter(Boolean)
    .map((pair) => {
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) {
        console.error(`⚠️   Skipping malformed attribute (no "="): ${pair}`);
        return null;
      }
      const trait_type = pair.slice(0, eqIdx).trim();
      const rawValue   = pair.slice(eqIdx + 1).trim();
      // Coerce numeric values
      const value = isNaN(rawValue) ? rawValue : Number(rawValue);
      return { trait_type, value };
    })
    .filter(Boolean);

  return { apiKey, name, description, imageCID, rarity, extraAttributes };
}

/**
 * Builds an ERC-721 / OpenSea-compatible metadata object.
 *
 * Schema:
 * {
 *   name:        string,
 *   description: string,
 *   image:       string  (ipfs:// URI),
 *   external_url: string (optional marketplace link),
 *   attributes: [
 *     { trait_type: string, value: string | number },
 *     ...
 *     // display_type "number" used for numeric traits
 *   ]
 * }
 */
function buildMetadata({ name, description, imageCID, rarity, extraAttributes }) {
  const baseAttributes = [
    {
      trait_type: "Rarity",
      value:      rarity,
    },
    {
      display_type: "number",
      trait_type:   "Rarity Power",
      value:        RARITY_POWER[rarity],
    },
  ];

  // Merge extra attributes (numeric traits get display_type: "number")
  const extraFormatted = extraAttributes.map(({ trait_type, value }) =>
    typeof value === "number"
      ? { display_type: "number", trait_type, value }
      : { trait_type, value }
  );

  return {
    // ── Required ERC-721 fields ─────────────────────────────────────────────
    name,
    description,
    image: imageCID,

    // ── Marketplace / display hints ─────────────────────────────────────────
    external_url: "https://your-marketplace-domain.com",   // TODO: update after deploy
    background_color: "0d0d0d",  // hex without #, used by OpenSea

    // ── Attributes ──────────────────────────────────────────────────────────
    attributes: [...baseAttributes, ...extraFormatted],
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const params = validate();
  const { apiKey, name, description, imageCID, rarity, extraAttributes } = params;

  const metadata = buildMetadata(params);

  // Pretty-print metadata to stderr so the user can review it
  console.error("\n📋  Metadata to upload:");
  console.error("─────────────────────────────────────────────────────────");
  console.error(JSON.stringify(metadata, null, 2));
  console.error("─────────────────────────────────────────────────────────");
  console.error(`☁️   Uploading metadata to IPFS via nft.storage…`);

  const client = new NFTStorage({ token: apiKey });

  // Serialize metadata as UTF-8 JSON and upload as a Blob
  const jsonString = JSON.stringify(metadata);
  const blob       = new Blob([jsonString], { type: "application/json" });
  const cid        = await client.storeBlob(blob);

  const uri = `ipfs://${cid}`;

  console.error(`\n✅  Metadata upload successful!`);
  console.error(`🔗  Gateway  : https://nftstorage.link/ipfs/${cid}`);
  console.error(`─────────────────────────────────────────────────────────`);
  console.error(`\nPaste this URI into your mintCard() call:`);
  console.error(`  await marketplace.mintCard("${uri}");`);
  console.error(`─────────────────────────────────────────────────────────`);

  // Clean CID URI on stdout for easy capture / piping
  console.log(uri);
}

main().catch((err) => {
  console.error("❌  Metadata upload failed:", err.message ?? err);
  process.exit(1);
});