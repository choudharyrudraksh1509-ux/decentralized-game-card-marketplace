/**
 * Minimal Express server for IPFS uploads using nft.storage
 *
 * Instructions to run:
 * 1. Make sure you have installed dependencies: `npm install` in the backend/ dir.
 * 2. Ensure your backend/.env file has: NFT_STORAGE_API_KEY=your_key_here
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

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Configure multer to temporarily store uploaded files
const upload = multer({ dest: 'uploads/' });

// Helper to initialize the nft.storage client
const getClient = () => {
  const token = process.env.NFT_STORAGE_API_KEY;
  if (!token) {
    throw new Error('NFT_STORAGE_API_KEY is not defined in the environment variables.');
  }
  return new NFTStorage({ token });
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

    const client = getClient();

    // Read the file from the temporary multer path
    const buffer = fs.readFileSync(req.file.path);
    
    // Create an nft.storage File object
    const file = new File([buffer], req.file.originalname, { type: req.file.mimetype });

    // Store it on IPFS
    const cid = await client.storeBlob(file);

    // Clean up the temporary file
    fs.unlinkSync(req.file.path);

    // Return the resulting CID
    res.json({ cid: `ipfs://${cid}` });
  } catch (error) {
    console.error('Error in /upload-image:', error.message);
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

    const client = getClient();

    // Build the metadata object compliant with ERC-721 / OpenSea standards
    const metadata = {
      name,
      description,
      image: imageCID,
      attributes: [
        { trait_type: 'Rarity', value: rarity }
      ]
    };

    const metadataString = JSON.stringify(metadata);
    const file = new File([metadataString], 'metadata.json', { type: 'application/json' });

    // Store the JSON string as a blob on IPFS
    const cid = await client.storeBlob(file);

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