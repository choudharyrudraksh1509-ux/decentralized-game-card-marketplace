/**
 * Minimal Express server for IPFS uploads using nft.storage
 *
 * Instructions to run:
 * 1. Make sure you have installed dependencies: `npm install` in the backend/ dir.
 * 2. Ensure your backend/.env file has: NFT_STORAGE_API_KEY=your_key_here
 *    (If missing, empty, or starting with "mock", the server will run in Mock Mode).
 * 3. Start the server from the project root or backend folder:
 * 
 *    node backend/server.js
 * 
 * The server will run on port 5000.
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { NFTStorage, File } from 'nft.storage';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. Serve static folders for mock mode IPFS simulation
app.use('/images', express.static('public/images'));
app.use('/metadata', express.static('public/metadata'));

// Configure multer to temporarily store uploaded files
const upload = multer({ dest: 'uploads/' });

// Determine if we should run in Mock Mode
const apiKey = process.env.NFT_STORAGE_API_KEY || "";
const isMockMode = !apiKey || apiKey.trim() === "" || apiKey.startsWith("mock");

if (isMockMode) {
  console.log("===============================================================");
  console.log("[IPFS MOCK MODE] Using local static folders for IPFS simulation.");
  console.log("No valid NFT_STORAGE_API_KEY found in environment.");
  console.log("===============================================================");
  
  // Ensure local folders exist so we don't crash when saving mock files
  const imagesDir = path.join(process.cwd(), 'public', 'images');
  const metadataDir = path.join(process.cwd(), 'public', 'metadata');
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir, { recursive: true });
}

// Helper to initialize the nft.storage client
const getClient = () => {
  if (isMockMode) return null;
  return new NFTStorage({ token: apiKey });
};

// -----------------------------------------------------------------------------
// Endpoint 1: Upload Image
// Receives a multipart file, uploads it to IPFS, and returns the image CID.
// -----------------------------------------------------------------------------
app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    let cid;

    if (isMockMode) {
      // 2. Generate a mock CID preserving the extension, copy the file to public/images
      const ext = path.extname(req.file.originalname) || '';
      cid = `QmMockImageHash_${Date.now()}${ext}`;
      const targetPath = path.join(process.cwd(), 'public', 'images', cid);
      
      fs.copyFileSync(req.file.path, targetPath);
    } else {
      const client = getClient();
      // Read the file from the temporary multer path
      const buffer = fs.readFileSync(req.file.path);
      // Create an nft.storage File object
      const file = new File([buffer], req.file.originalname, { type: req.file.mimetype });
      // Store it on IPFS
      cid = await client.storeBlob(file);
    }

    // Clean up the temporary file (happens in both real and mock modes)
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    // Return the resulting CID
    res.json({ cid: `ipfs://${cid}` });
  } catch (error) {
    console.error('Error in /upload-image:', error.message);
    // Attempt to clean up temp file if something crashed before cleanup
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// -----------------------------------------------------------------------------
// Endpoint 2: Create Metadata
// Receives JSON (name, description, imageCID, rarity), uploads to IPFS, returns CID.
// -----------------------------------------------------------------------------
app.post('/create-metadata', async (req, res) => {
  try {
    const { name, description, imageCID, rarity } = req.body;

    if (!name || !description || !imageCID || !rarity) {
      return res.status(400).json({ error: 'Missing required fields (name, description, imageCID, rarity).' });
    }

    // Build the metadata object compliant with ERC-721 / OpenSea standards
    const metadata = {
      name,
      description,
      image: imageCID,
      attributes: [
        { trait_type: 'Rarity', value: rarity }
      ]
    };

    let cid;

    if (isMockMode) {
      // 3. Save the JSON object as a file in public/metadata
      cid = `QmMockMetaHash_${Date.now()}.json`;
      const targetPath = path.join(process.cwd(), 'public', 'metadata', cid);
      
      fs.writeFileSync(targetPath, JSON.stringify(metadata, null, 2));
    } else {
      const client = getClient();
      
      const metadataString = JSON.stringify(metadata);
      const file = new File([metadataString], 'metadata.json', { type: 'application/json' });

      // Store the JSON string as a blob on IPFS
      cid = await client.storeBlob(file);
    }

    // Return the resulting CID
    res.json({ cid: `ipfs://${cid}` });
  } catch (error) {
    console.error('Error in /create-metadata:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server successfully started on port ${PORT}`);
  console.log(`Endpoints ready:`);
  console.log(`  POST http://localhost:${PORT}/upload-image`);
  console.log(`  POST http://localhost:${PORT}/create-metadata`);
});