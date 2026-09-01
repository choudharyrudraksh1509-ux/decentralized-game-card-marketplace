/**
 * MintCardForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-step form for minting a new game card NFT.
 *
 * Step 1 – Image upload to IPFS (POST /api/ipfs/upload-asset)
 * Step 2 – Metadata creation on IPFS (POST /api/ipfs/create-metadata)
 * Step 3 – On-chain mintCardWithHash() via wagmi writeContract
 * Step 4 – Wait for transaction confirmation + parse CardMinted event
 * Step 5 – Finalize Copyright mapping in backend & Invalidate Caches
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useMintCard, isContractConfigured, CONTRACT_ADDRESS } from "../hooks/useMarketplace";
import { useAuth } from "../context/AuthContext";
import { finalizeCopyright } from "../api/auth";
import ABI from "../abi/GameCardMarketplace.json";

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:5000";
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

const RARITY_STYLES = {
  Common:    "text-muted   border-ash",
  Uncommon:  "text-parchment border-ash",
  Rare:      "text-amber-light border-amber/50",
  Epic:      "text-crimson-light border-crimson/50",
  Legendary: "text-gold-light  border-gold/50",
};

const MAX_FILE_SIZE_MB = 20;

// ── IPFS API helpers ──────────────────────────────────────────────────────────

async function apiUploadAsset(file) {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BACKEND_URL}/upload-image`, {
    method: "POST",
    body:   form,
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 409) throw new Error(`COPYRIGHT_VIOLATION:${data.error}`);
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  return data; // { cid, image_hash }
}

async function apiCreateMetadata({ name, description, imageCID, rarity, attributes }) {
  const res = await fetch(`${BACKEND_URL}/create-metadata`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name, description, imageCID, rarity }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 409) throw new Error(`COPYRIGHT_VIOLATION:${data.error}`);
    throw new Error(data.error ?? `Metadata failed (${res.status})`);
  }
  return data; // { cid, metadata_hash }
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate({ image, name, description, rarity }) {
  const errors = {};
  if (!image)                                errors.image       = "Select an image file.";
  else if (!image.type.startsWith("image/")) errors.image       = "File must be an image.";
  else if (image.size > MAX_FILE_SIZE_MB * 1024 * 1024)
    errors.image = `Image must be < ${MAX_FILE_SIZE_MB} MB.`;
  if (!name.trim())                          errors.name        = "Name is required.";
  else if (name.trim().length > 64)          errors.name        = "Max 64 characters.";
  if (!description.trim())                   errors.description = "Description is required.";
  else if (description.trim().length > 500)  errors.description = "Max 500 characters.";
  if (!RARITIES.includes(rarity))            errors.rarity      = "Select a rarity.";
  return errors;
}

// ── Stage helpers ─────────────────────────────────────────────────────────────

const STAGE_LABELS = {
  "idle":           null,
  "uploading-image":"Uploading image to IPFS…",
  "creating-meta":  "Creating metadata on IPFS…",
  "confirm-tx":     "Waiting for wallet confirmation…",
  "pending-tx":     "Transaction submitted — waiting for confirmation…",
  "success":        "Minted successfully!",
  "error":          null,
};

function isBusy(stage) {
  return ["uploading-image","creating-meta","confirm-tx","pending-tx"].includes(stage);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldError({ msg }) {
  if (!msg) return null;
  return <p role="alert" className="text-crimson-light text-xs mt-1">{msg}</p>;
}

function Label({ children, required }) {
  return (
    <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">
      {children}
      {required && <span className="text-crimson ml-1" aria-hidden>*</span>}
    </label>
  );
}

function InputField({ id, label, required, error, textarea, ...props }) {
  const Comp = textarea ? "textarea" : "input";
  return (
    <div>
      <Label htmlFor={id} required={required}>{label}</Label>
      <Comp
        id={id}
        className={`w-full bg-graphite border rounded-lg px-4 py-2.5 text-ivory placeholder-muted/50
                    focus:outline-none focus:ring-1 focus:ring-gold transition-colors
                    ${error ? "border-crimson" : "border-ash"}`}
        aria-invalid={Boolean(error)}
        {...props}
      />
      <FieldError msg={error} />
    </div>
  );
}

function ImagePicker({ onChange, preview, error, disabled }) {
  const fileInputRef = useRef(null);
  return (
    <div>
      <Label required>Card Artwork</Label>
      <div
        className={`relative w-full aspect-[3/4] max-h-[300px] flex items-center justify-center
                    rounded-xl border-2 border-dashed overflow-hidden bg-graphite transition-colors
                    ${error ? "border-crimson" : "border-ash"}
                    ${disabled ? "opacity-50 pointer-events-none" : "hover:border-gold/50 cursor-pointer"}`}
        onClick={() => fileInputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Artwork preview" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-muted p-4">
            <span className="text-3xl block mb-2 opacity-50" aria-hidden>🖼️</span>
            <span className="text-sm font-semibold">Click to upload</span>
            <span className="block text-xs mt-1">JPEG, PNG, WEBP (max {MAX_FILE_SIZE_MB}MB)</span>
          </div>
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={onChange}
        className="hidden"
        disabled={disabled}
      />
      <FieldError msg={error} />
    </div>
  );
}

function MintProgress({ stage, txHash, tokenId }) {
  if (stage === "idle" || stage === "error") return null;
  const isSuccess = stage === "success";

  return (
    <div className={`p-4 rounded-xl border ${isSuccess ? "bg-gold/10 border-gold/40 text-gold" : "bg-obsidian border-ash text-parchment"}`}>
      <div className="flex items-center gap-3">
        {isSuccess ? (
          <span className="text-2xl" aria-hidden>🎉</span>
        ) : (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
        )}
        <div>
          <p className="font-semibold text-sm">{STAGE_LABELS[stage] ?? "Processing…"}</p>
          {txHash && (
            <p className="text-xs opacity-80 mt-0.5">
              Tx: <span className="font-mono">{txHash.slice(0,10)}…{txHash.slice(-8)}</span>
            </p>
          )}
          {isSuccess && tokenId !== null && (
            <p className="text-xs font-bold mt-1">Token ID: #{tokenId.toString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MintCardForm({ onMintSuccess }) {
  const { isConnected } = useAccount();
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();

  const {
    mintCard,
    stage: wagmiStage,
    txHash,
    tokenId,
    error: wagmiError,
    reset: resetWagmi,
  } = useMintCard();

  const [image,       setImage]       = useState(null);
  const [preview,     setPreview]     = useState("");
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [rarity,      setRarity]      = useState("");
  
  const [fieldErrors, setFieldErrors] = useState({});
  const [mintStage,   setMintStage]   = useState("idle");
  const [stageError,  setStageError]  = useState("");
  const [imageCID,    setImageCID]    = useState("");
  const [metaCID,     setMetaCID]     = useState("");

  const [imageHashStr, setImageHashStr] = useState("");
  const [metaHashStr,  setMetaHashStr]  = useState("");

  const [copyrightViolation, setCopyrightViolation] = useState(null);

  const effectiveStage = (wagmiStage === "idle" || wagmiStage === "error") && mintStage !== "idle"
    ? mintStage
    : wagmiStage;

  const error = (mintStage === "error" ? stageError : null) ?? wagmiError;
  const busy  = isBusy(effectiveStage);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setFieldErrors((prev) => ({ ...prev, image: undefined }));
    }
  };

  const handleReset = useCallback(() => {
    setImage(null);
    setPreview("");
    setName("");
    setDescription("");
    setRarity("");
    setFieldErrors({});
    setMintStage("idle");
    setStageError("");
    setImageCID("");
    setMetaCID("");
    setImageHashStr("");
    setMetaHashStr("");
    setCopyrightViolation(null);
    resetWagmi();
  }, [resetWagmi]);

  // Finalize copyright and invalidate ALL caches on success for instant zero-refresh
  useEffect(() => {
    if (wagmiStage === "success" && tokenId !== null && user) {
      finalizeCopyright({
        image_hash: imageHashStr || null,
        metadata_hash: metaHashStr || null,
        token_id: Number(tokenId),
        owner_wallet: user.wallet_address
      })
      .then(() => {
        // Invalidate ALL queries across Wagmi and custom caches for instant auto-update
        queryClient.invalidateQueries();
      })
      .catch(err => console.error("Finalization failed:", err));
    } else if (wagmiStage === "success" && tokenId !== null) {
      // Invalidate queries even if user object hasn't finished loading
      queryClient.invalidateQueries();
    }
  }, [wagmiStage, tokenId, user, imageHashStr, metaHashStr, queryClient]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (busy) return;

    setStageError("");
    setMintStage("idle");
    setCopyrightViolation(null);

    const validationErrors = validate({ image, name, description, rarity });
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    try {
      // Step 1: image upload
      setMintStage("uploading-image");
      const { cid: assetCid, image_hash } = await apiUploadAsset(image);
      setImageCID(assetCid);
      setImageHashStr(image_hash);

      // Step 2: metadata creation
      setMintStage("creating-meta");
      const { cid: metadataURI, metadata_hash } = await apiCreateMetadata({
        name:        name.trim(),
        description: description.trim(),
        imageCID:    assetCid,
        rarity,
        attributes:  [], 
      });
      setMetaCID(metadataURI);
      setMetaHashStr(metadata_hash);

      // Step 3: Check on-chain registration BEFORE opening MetaMask
      const rawHex = metadata_hash.startsWith('0x') ? metadata_hash.slice(2) : metadata_hash;
      const bytes32Hash = `0x${rawHex.padEnd(64, '0').slice(0, 64)}`;

      if (publicClient) {
        try {
          const isRegistered = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'registeredHashes',
            args: [bytes32Hash]
          });
          if (isRegistered) {
            throw new Error("COPYRIGHT_VIOLATION: This card metadata/content is already patented and registered on the blockchain!");
          }
        } catch (readErr) {
          if (readErr.message && readErr.message.includes("COPYRIGHT_VIOLATION")) {
            throw readErr;
          }
          // Ignore general read errors (e.g. node connectivity during test setup)
        }
      }

      // Step 4: On-chain mint via Wagmi writeContract
      setMintStage("idle"); 
      await mintCard(metadataURI, bytes32Hash);

      onMintSuccess?.({ name, rarity, metadataURI });

    } catch (err) {
      if (err.message && err.message.startsWith("COPYRIGHT_VIOLATION:")) {
         setCopyrightViolation(err.message.replace("COPYRIGHT_VIOLATION:", ""));
      } else {
         setStageError(err.message ?? "An error occurred.");
      }
      setMintStage("error");
    }
  }, [image, name, description, rarity, mintCard, onMintSuccess, busy, publicClient]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="card-tile p-6 text-center flex flex-col items-center gap-3">
        <span className="text-4xl" aria-hidden>🔒</span>
        <p className="text-parchment font-semibold">Connect your wallet to mint cards.</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="card-tile p-6 text-center flex flex-col items-center gap-3">
        <span className="text-4xl" aria-hidden>👤</span>
        <p className="text-parchment font-semibold">Please Login or Register to mint game cards.</p>
      </div>
    );
  }

  if (!isContractConfigured()) {
    return (
      <div className="card-tile p-6 flex flex-col gap-2">
        <p className="text-crimson-light font-semibold text-sm">⚠️ Contract not configured</p>
        <p className="text-muted text-xs">
          Set <code className="font-mono text-parchment">VITE_CONTRACT_ADDRESS</code> in{" "}
          <code className="font-mono text-parchment">frontend/.env</code> and restart Vite.
        </p>
      </div>
    );
  }

  const showProgress = effectiveStage !== "idle" || wagmiStage !== "idle";

  return (
    <section className="card-tile p-6 flex flex-col gap-6 w-full max-w-lg mx-auto relative">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold text-ivory uppercase tracking-widest">
          Mint a Card
        </h2>
        <p className="text-muted text-xs mt-1">
          Upload artwork, fill in details, and mint your card as an NFT protected by copyright hashing.
        </p>
        <p className="text-muted text-[10px] font-mono mt-1 break-all">
          Contract: {CONTRACT_ADDRESS.slice(0,10)}&hellip;{CONTRACT_ADDRESS.slice(-6)}
        </p>
      </div>

      {/* Progress display (visible during and after the mint flow) */}
      {showProgress && (
        <MintProgress
          stage={effectiveStage === "idle" ? wagmiStage : effectiveStage}
          txHash={txHash}
          tokenId={tokenId}
        />
      )}

      {/* Standard Error state */}
      {!copyrightViolation && (effectiveStage === "error" || wagmiStage === "error") && error && (
        <div role="alert" className="rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3">
          <p className="text-crimson-light text-sm font-semibold">Minting failed</p>
          <p className="text-muted text-xs mt-1 break-all">{error}</p>
        </div>
      )}

      {/* 🔴 COPYRIGHT VIOLATION ALERT 🔴 */}
      {copyrightViolation && (
        <div role="alert" className="rounded-xl border-2 border-crimson shadow-[0_0_20px_rgba(220,38,38,0.5)] bg-obsidian px-6 py-5 animate-pulse">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🚫</span>
            <h3 className="text-crimson-light text-lg font-bold font-display uppercase tracking-wider">Copyright Violation</h3>
          </div>
          <p className="text-ivory text-sm leading-relaxed mb-4">
            {copyrightViolation}
          </p>
          <button onClick={handleReset} className="w-full py-2 bg-crimson/20 hover:bg-crimson/40 border border-crimson text-crimson-light font-bold rounded transition-colors text-sm uppercase tracking-wider">
            Acknowledge & Reset
          </button>
        </div>
      )}

      {/* Success: show Mint Another button */}
      {wagmiStage === "success" ? (
        <button onClick={handleReset} className="btn-primary w-full mt-4">
          Mint Another Card
        </button>
      ) : (
        <form onSubmit={handleSubmit} noValidate className={`flex flex-col gap-5 ${copyrightViolation ? 'hidden' : ''}`}>
          {/* Image picker */}
          <ImagePicker
            onChange={handleImageChange}
            preview={preview}
            error={fieldErrors.image}
            disabled={busy}
          />

          {/* Name */}
          <InputField
            id="card-name"
            label="Card Name"
            required
            type="text"
            placeholder='e.g. "Inferno Drake"'
            value={name}
            onChange={(e) => { setName(e.target.value); setFieldErrors(er => ({...er, name: undefined})); }}
            maxLength={64}
            error={fieldErrors.name}
            disabled={busy}
          />

          {/* Description */}
          <InputField
            id="card-desc"
            label="Description"
            required
            textarea
            rows={3}
            placeholder="A brief lore description of the card…"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setFieldErrors(er => ({...er, description: undefined})); }}
            maxLength={500}
            error={fieldErrors.description}
            disabled={busy}
          />
          <p className="text-muted text-[10px] -mt-3 text-right">{description.length}/500</p>

          {/* Rarity */}
          <div>
            <Label required>Rarity</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Rarity">
              {RARITIES.map((r) => (
                <label
                  key={r}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 px-2 py-2.5
                              cursor-pointer transition-all duration-150 text-xs font-semibold
                              ${rarity === r
                                ? `${RARITY_STYLES[r]} bg-ash`
                                : "border-ash text-muted hover:border-ash/80"}
                              ${busy ? "pointer-events-none opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="rarity"
                    value={r}
                    checked={rarity === r}
                    onChange={() => { setRarity(r); setFieldErrors(er => ({...er, rarity: undefined})); }}
                    className="sr-only"
                    disabled={busy}
                  />
                  <span className="text-base mb-0.5" aria-hidden>
                    {r === "Legendary" ? "⭐" : r === "Epic" ? "🔴" : r === "Rare" ? "🟡" : r === "Uncommon" ? "🟢" : "⚪"}
                  </span>
                  {r}
                </label>
              ))}
            </div>
            <FieldError msg={fieldErrors.rarity} />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full text-base py-3 mt-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(245,158,11,0.2)]"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full border-2 border-obsidian border-t-transparent animate-spin" aria-hidden />
                {STAGE_LABELS[effectiveStage === "idle" ? wagmiStage : effectiveStage] ?? "Processing…"}
              </span>
            ) : "Mint Card"}
          </button>

          {/* IPFS CID debug info (collapsed) */}
          {(imageCID || metaCID) && (
            <details className="text-[10px] font-mono text-muted">
              <summary className="cursor-pointer hover:text-parchment">IPFS debug info</summary>
              <div className="mt-2 flex flex-col gap-1 break-all">
                {imageCID  && <p><span className="text-muted">Image:</span>    {imageCID}</p>}
                {metaCID   && <p><span className="text-muted">Metadata:</span> {metaCID}</p>}
              </div>
            </details>
          )}
        </form>
      )}
    </section>
  );
}