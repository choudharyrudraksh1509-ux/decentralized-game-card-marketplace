/**
 * backend/server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight Express server that bridges the React frontend to the Node.js
 * IPFS upload scripts (ipfs/uploadAsset.js, ipfs/createMetadata.js).
 *
 * The browser cannot run Node scripts directly, so this server:
 *   POST /api/ipfs/upload-asset    → spawns uploadAsset.js, returns imageCID
 *   POST /api/ipfs/create-metadata → spawns createMetadata.js, returns metaCID
 *   GET  /api/health               → liveness check
 *
 * Run:
 *   cd backend && npm start        (production)
 *   cd backend && npm run dev      (nodemon auto-reload)
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const express    = require("express");
const cors       = require("cors");
const multer     = require("multer");
const path       = require("path");
const fs         = require("fs");
const os         = require("os");
const { spawn }  = require("child_process");
require("dotenv").config();

// ── Config ────────────────────────────────────────────────────────────────────

const PORT        = parseInt(process.env.PORT ?? "3001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const API_KEY     = process.env.NFT_STORAGE_API_KEY ?? "";

// Absolute path to the ipfs/ directory (one level up from backend/)
const IPFS_DIR = path.resolve(__dirname, "..", "ipfs");

// ── Express setup ─────────────────────────────────────────────────────────────

const app = express();

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// ── Multer: store uploads in OS temp dir ──────────────────────────────────────

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename:    (_req, file, cb) => {
      const ext  = path.extname(file.originalname);
      const name = `card-asset-${Date.now()}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are accepted."));
  },
});

// ── Utility: spawn a node script and capture stdout ───────────────────────────

/**
 * Runs `node <scriptPath> [...args]` with NFT_STORAGE_API_KEY in env.
 * Resolves with the trimmed stdout string.
 * Rejects on non-zero exit or if stdout is empty.
 */
function runIpfsScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,     // same node binary that is running the server
      [scriptPath, ...args],
      {
        env: {
          ...process.env,
          NFT_STORAGE_API_KEY: API_KEY,
        },
        // Scripts use ESM (ipfs/package.json has "type":"module"), so we
        // must run them inside the ipfs/ directory so Node respects that.
        cwd: IPFS_DIR,
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        const detail = stderr.trim() || `Script exited with code ${code}`;
        return reject(new Error(detail));
      }
      const result = stdout.trim();
      if (!result) return reject(new Error("Script produced no output on stdout."));
      resolve(result);
    });

    child.on("error", reject);
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /api/health — simple liveness check */
app.get("/api/health", (_req, res) => {
  res.json({
    ok:      true,
    service: "game-card-marketplace-backend",
    ipfsDir: IPFS_DIR,
    apiKey:  API_KEY ? "set" : "MISSING",
  });
});

/**
 * POST /api/ipfs/upload-asset
 * multipart/form-data  { image: <file> }
 * → { cid: "ipfs://..." }
 */
app.post("/api/ipfs/upload-asset", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided." });
  }

  const tmpPath = req.file.path;

  try {
    if (!API_KEY) throw new Error("NFT_STORAGE_API_KEY is not configured on the server.");

    // uploadAsset.js argv[2] = absolute path to the image
    const scriptPath = path.join(IPFS_DIR, "uploadAsset.js");
    const cid = await runIpfsScript(scriptPath, [tmpPath]);

    res.json({ cid });
  } catch (err) {
    console.error("[upload-asset] Error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    // Always clean up the temp file
    fs.unlink(tmpPath, () => {});
  }
});

/**
 * POST /api/ipfs/create-metadata
 * JSON body { name, description, imageCID, rarity, attributes?: [{trait_type, value}] }
 * → { cid: "ipfs://..." }
 */
app.post("/api/ipfs/create-metadata", async (req, res) => {
  const { name, description, imageCID, rarity, attributes = [] } = req.body ?? {};

  // Basic validation
  const missing = ["name", "description", "imageCID", "rarity"].filter(
    (k) => !req.body?.[k]?.trim?.()
  );
  if (missing.length) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
  }

  try {
    if (!API_KEY) throw new Error("NFT_STORAGE_API_KEY is not configured on the server.");

    const scriptPath = path.join(IPFS_DIR, "createMetadata.js");

    // Build positional args: name description imageCID rarity [key=value ...]
    const extraArgs = attributes.map(({ trait_type, value }) => `${trait_type}=${value}`);
    const args = [name, description, imageCID, rarity, ...extraArgs];

    const cid = await runIpfsScript(scriptPath, args);
    res.json({ cid });
  } catch (err) {
    console.error("[create-metadata] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Error handler ─────────────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error("[unhandled]", err.message);
  res.status(500).json({ error: err.message ?? "Internal server error." });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🃏  Game Card Marketplace — Backend Server`);
  console.log(`   Listening on  http://localhost:${PORT}`);
  console.log(`   CORS origin   ${CORS_ORIGIN}`);
  console.log(`   IPFS scripts  ${IPFS_DIR}`);
  console.log(`   NFT_STORAGE_API_KEY: ${API_KEY ? "✅ set" : "❌ MISSING — set it in backend/.env"}\n`);
});