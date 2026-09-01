/**
 * Express Server for IPFS Uploads & User Authentication & Anti-Duplication
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { NFTStorage, File } from 'nft.storage';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Sequelize, DataTypes, Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_123';

app.use(cors());
app.use(express.json());

// ── 1. Static folders for IPFS mock simulation ──────────────────────────────
app.use('/images', express.static('public/images'));
app.use('/metadata', express.static('public/metadata'));

// ── 2. Database & Auth Setup (SQLite + Sequelize) ───────────────────────────
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(process.cwd(), 'database.sqlite'),
  logging: false, // Disable SQL logging
});

const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  full_name: { type: DataTypes.STRING },
  wallet_address: { 
    type: DataTypes.STRING, 
    unique: true, 
    allowNull: false,
    set(val) {
      this.setDataValue('wallet_address', val ? val.toLowerCase() : null);
    }
  },
  avatar_url: { type: DataTypes.STRING },
  reset_otp: { type: DataTypes.STRING },
  reset_otp_expires: { type: DataTypes.DATE }
}, {
  createdAt: 'created_at',
  updatedAt: false
});

// Anti-Duplication Copyright Registry
const CardRegistry = sequelize.define('CardRegistry', {
  image_hash: { type: DataTypes.STRING, unique: true },
  metadata_hash: { type: DataTypes.STRING, unique: true },
  token_id: { type: DataTypes.INTEGER },
  owner_wallet: { type: DataTypes.STRING }
}, {
  createdAt: 'created_at',
  updatedAt: false
});

// Sync database
(async () => {
  try {
    await sequelize.sync();
    console.log('[DB] SQLite Database synced successfully.');
  } catch (error) {
    console.error('[DB ERROR] Failed to sync database:', error);
  }
})();

// JWT Middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};

// ── 3. IPFS Upload logic (NFT.Storage + Mock Fallback) ──────────────────────
const upload = multer({ dest: 'uploads/' });
const apiKey = process.env.NFT_STORAGE_API_KEY || "";
const isMockMode = !apiKey || apiKey.trim() === "" || apiKey.startsWith("mock");

if (isMockMode) {
  console.log("===============================================================");
  console.log("[IPFS MOCK MODE] Using local static folders for IPFS simulation.");
  console.log("===============================================================");
  const imagesDir = path.join(process.cwd(), 'public', 'images');
  const metadataDir = path.join(process.cwd(), 'public', 'metadata');
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  if (!fs.existsSync(metadataDir)) fs.mkdirSync(metadataDir, { recursive: true });
}

const getClient = () => isMockMode ? null : new NFTStorage({ token: apiKey });

// Helper to verify if a token_id is still active on-chain via eth_call
async function isTokenActiveOnChain(tokenId) {
  if (!tokenId) return false;
  try {
    const res = await fetch('http://127.0.0.1:8545', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: process.env.VITE_CONTRACT_ADDRESS || '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
            // ownerOf(uint256) selector: 0x6352211e
            data: '0x6352211e' + BigInt(tokenId).toString(16).padStart(64, '0')
          },
          'latest'
        ]
      })
    });
    const json = await res.json();
    if (json.result && json.result.length >= 66 && !json.result.endsWith('0000000000000000000000000000000000000000')) {
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided.' });

    // Anti-Duplication Check: Image Hash
    const buffer = fs.readFileSync(req.file.path);
    const imageHash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Check if this image is registered to an active token
    const existingImage = await CardRegistry.findOne({ where: { image_hash: imageHash } });
    if (existingImage && existingImage.token_id !== null) {
      const active = await isTokenActiveOnChain(existingImage.token_id);
      if (active) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(409).json({ 
          error: "Duplicate Image Detected! This artwork is already patented and minted on Card Nexus." 
        });
      } else {
        // Token was burned/deleted on-chain! Auto-release stale DB record
        await CardRegistry.destroy({ where: { id: existingImage.id } });
      }
    }

    let cid;
    if (isMockMode) {
      const ext = path.extname(req.file.originalname) || '';
      cid = `QmMockImageHash_${Date.now()}${ext}`;
      fs.copyFileSync(req.file.path, path.join(process.cwd(), 'public', 'images', cid));
    } else {
      const client = getClient();
      const file = new File([buffer], req.file.originalname, { type: req.file.mimetype });
      cid = await client.storeBlob(file);
    }
    
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({ cid: `ipfs://${cid}`, image_hash: imageHash });
  } catch (error) {
    console.error('Error in /upload-image:', error.message);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload-avatar', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided.' });

    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `avatar_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
    const targetPath = path.join(process.cwd(), 'public', 'images', filename);

    fs.copyFileSync(req.file.path, targetPath);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({ url: `http://localhost:5000/images/${filename}` });
  } catch (error) {
    console.error('Error in /upload-avatar:', error.message);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message });
  }
});

app.post('/create-metadata', async (req, res) => {
  try {
    const { name, description, imageCID, rarity } = req.body;
    if (!name || !description || !imageCID || !rarity) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Anti-Duplication Check: Metadata Content
    const textToHash = `${name.trim().toLowerCase()}:${description.trim().toLowerCase()}`;
    const metaHash = crypto.createHash('sha256').update(textToHash).digest('hex');

    const existingMeta = await CardRegistry.findOne({ where: { metadata_hash: metaHash } });
    if (existingMeta && existingMeta.token_id !== null) {
      const active = await isTokenActiveOnChain(existingMeta.token_id);
      if (active) {
        return res.status(409).json({ 
          error: "Duplicate Metadata Detected! A card with this title and description already exists." 
        });
      } else {
        // Token was burned/deleted on-chain! Auto-release stale DB record
        await CardRegistry.destroy({ where: { id: existingMeta.id } });
      }
    }

    const metadata = { name, description, image: imageCID, attributes: [{ trait_type: 'Rarity', value: rarity }] };
    let cid;
    if (isMockMode) {
      cid = `QmMockMetaHash_${Date.now()}.json`;
      fs.writeFileSync(path.join(process.cwd(), 'public', 'metadata', cid), JSON.stringify(metadata, null, 2));
    } else {
      const client = getClient();
      const file = new File([JSON.stringify(metadata)], 'metadata.json', { type: 'application/json' });
      cid = await client.storeBlob(file);
    }

    res.json({ cid: `ipfs://${cid}`, metadata_hash: metaHash });
  } catch (error) {
    console.error('Error in /create-metadata:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to finalize the copyright after on-chain minting
app.post('/api/registry/finalize', async (req, res) => {
  try {
    const { image_hash, metadata_hash, token_id, owner_wallet } = req.body;
    if (!token_id || !owner_wallet) return res.status(400).json({ error: 'Missing token_id or owner_wallet' });

    // Clean up any unfinalized temporary entries first
    if (image_hash) await CardRegistry.destroy({ where: { image_hash } });
    if (metadata_hash) await CardRegistry.destroy({ where: { metadata_hash } });

    // Create single clean finalized row
    await CardRegistry.create({
      image_hash,
      metadata_hash,
      token_id: Number(token_id),
      owner_wallet: owner_wallet.toLowerCase()
    });

    res.json({ message: "Copyright finalized successfully." });
  } catch (error) {
    console.error('Error finalizing copyright:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to release copyright after burning/deleting a card
app.post('/api/registry/release', async (req, res) => {
  try {
    const { token_id, image_hash, metadata_hash } = req.body;

    if (token_id) {
      await CardRegistry.destroy({ where: { token_id: Number(token_id) } });
    }
    if (image_hash) {
      await CardRegistry.destroy({ where: { image_hash } });
    }
    if (metadata_hash) {
      await CardRegistry.destroy({ where: { metadata_hash } });
    }

    res.json({ message: "Copyright released successfully upon card burn." });
  } catch (error) {
    console.error('Error releasing copyright:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ── 4. Authentication API Routes ────────────────────────────────────────────

const sanitizeUser = (user) => {
  const { password_hash, reset_otp, reset_otp_expires, ...safeUser } = user.toJSON();
  return safeUser;
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, full_name, wallet_address } = req.body;
    if (!username || !email || !password || !wallet_address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }, { wallet_address: wallet_address.toLowerCase() }]
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username, email, or wallet address already in use.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username,
      email,
      password_hash,
      full_name,
      wallet_address
    });

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, wallet_address: newUser.wallet_address },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: sanitizeUser(newUser) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) return res.status(400).json({ error: 'Missing identifier or password' });

    const user = await User.findOne({
      where: {
        [Op.or]: [{ username: identifier }, { email: identifier }]
      }
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, wallet_address: user.wallet_address },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.json({ message: 'If an account exists, a reset code was sent.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await user.update({ reset_otp: otp, reset_otp_expires: expires });

    // Send email using Nodemailer (with Ethereal Email test fallback if no SMTP configured)
    let previewUrl = null;
    try {
      let transporter;
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
      } else {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      }

      const mailOptions = {
        from: '"Card Nexus Support" <support@cardnexus.io>',
        to: user.email,
        subject: '🃏 Card Nexus - Password Reset Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0F172A; color: #F1F5F9; padding: 30px; border-radius: 12px;">
            <h2 style="color: #F59E0B;">Card Nexus Password Reset</h2>
            <p>Your 6-digit password verification code is:</p>
            <h1 style="color: #F59E0B; letter-spacing: 5px; background-color: #1E293B; padding: 15px; text-align: center; border-radius: 8px;">${otp}</h1>
            <p style="color: #94A3B8; font-size: 12px;">This code will expire in 15 minutes. If you did not request a password reset, please ignore this email.</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      previewUrl = nodemailer.getTestMessageUrl(info);

      console.log(`\n==============================================`);
      console.log(`[NODEMAILER] Password Reset Email Sent to: ${user.email}`);
      console.log(`Code: ${otp}`);
      if (previewUrl) {
        console.log(`📧 Ethereal Test Inbox URL: ${previewUrl}`);
      }
      console.log(`==============================================\n`);

    } catch (mailErr) {
      console.error('Nodemailer send error:', mailErr);
    }

    res.json({ 
      message: 'A 6-digit verification code has been generated and sent!',
      preview_url: previewUrl
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) return res.status(400).json({ error: 'Missing required fields' });

    const user = await User.findOne({ where: { email, reset_otp: otp } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired OTP.' });

    if (user.reset_otp_expires < new Date()) return res.status(400).json({ error: 'OTP has expired.' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);

    await user.update({ password_hash, reset_otp: null, reset_otp_expires: null });

    res.json({ message: 'Password has been successfully reset.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(sanitizeUser(user));
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const { full_name, avatar_url, current_password, new_password } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (full_name !== undefined) user.full_name = full_name;
    if (avatar_url !== undefined) user.avatar_url = avatar_url;
    
    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to update password.' });
      }
      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(new_password, salt);
    }

    await user.save();
    res.json({ message: 'Profile updated successfully', user: sanitizeUser(user) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server successfully started on port ${PORT}`);
  console.log(`Endpoints ready:`);
  console.log(`  POST http://localhost:${PORT}/upload-image`);
  console.log(`  POST http://localhost:${PORT}/create-metadata`);
  console.log(`  Auth API mounted at /api/auth/*`);
});