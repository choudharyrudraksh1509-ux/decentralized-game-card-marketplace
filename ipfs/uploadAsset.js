#!/usr/bin/env node
/**
 * uploadAsset.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Uploads a local image (or any binary file) to IPFS via nft.storage and
 * prints the resulting content-addressed URI.
 *
 * Usage:
 *   node ipfs/uploadAsset.js <path-to-file>
 *
 * Examples:
 *   node ipfs/uploadAsset.js ./assets/dragon.png
 *   node ipfs/uploadAsset.js ./assets/card_back.gif
 *
 * Environment variables (place in ipfs/.env or export before running):
 *   NFT_STORAGE_API_KEY  – your nft.storage API token
 *
 * Output:
 *   ipfs://<CID>
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NFTStorage, File } from "nft.storage";
import { readFileSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { createRequire } from "module";
import * as dotenv from "dotenv";
import mime from "mime-types";

// Load .env from the ipfs/ directory first, then fall back to project root.
dotenv.config({ path: new URL(".env", import.meta.url).pathname });
dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

// ── Helpers ───────────────────────────────────────────────────────────────────

function usage() {
  console.error(`
Usage:
  node ipfs/uploadAsset.js <path-to-image>

Example:
  node ipfs/uploadAsset.js ./assets/dragon.png

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

  const filePath = process.argv[2];
  if (!filePath) {
    console.error("❌  No file path provided.");
    usage();
  }

  const resolved = resolve(filePath);
  if (!existsSync(resolved)) {
    console.error(`❌  File not found: ${resolved}`);
    process.exit(1);
  }

  return { apiKey, resolved };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { apiKey, resolved } = validate();

  const filename  = basename(resolved);
  const mimeType  = mime.lookup(filename) || "application/octet-stream";
  const fileBytes = readFileSync(resolved);

  console.error(`📁  File     : ${resolved}`);
  console.error(`📄  Name     : ${filename}`);
  console.error(`🗂️   MIME type : ${mimeType}`);
  console.error(`📦  Size     : ${(fileBytes.length / 1024).toFixed(2)} KB`);
  console.error(`☁️   Uploading to IPFS via nft.storage…`);

  const client = new NFTStorage({ token: apiKey });

  // storeBlob uploads the raw bytes and returns the CID of the content.
  // The resulting URL is  ipfs://<CID>  (a v1 CID, base32-encoded).
  const file = new File([fileBytes], filename, { type: mimeType });
  const cid  = await client.storeBlob(file);

  const uri = `ipfs://${cid}`;

  console.error(`\n✅  Upload successful!`);
  console.error(`🔗  Gateway  : https://nftstorage.link/ipfs/${cid}/${filename}`);
  console.error(`─────────────────────────────────────────────────────────`);

  // The only line on stdout — scripts piping this output get a clean CID URI.
  console.log(uri);
}

main().catch((err) => {
  console.error("❌  Upload failed:", err.message ?? err);
  process.exit(1);
});