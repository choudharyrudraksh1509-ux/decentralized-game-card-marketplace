/**
 * MintCardForm.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Multi-step form for minting a new game card NFT.
 *
 * Step 1 – Image upload to IPFS (POST /api/ipfs/upload-asset)
 * Step 2 – Metadata creation on IPFS (POST /api/ipfs/create-metadata)
 * Step 3 – On-chain mintCard() via wagmi writeContract
 * Step 4 – Wait for transaction confirmation + parse CardMinted event
 *
 * Requires:
 *   - frontend/.env: VITE_CONTRACT_ADDRESS=0x...
 *   - backend server running on http://localhost:3001
 *   - Wallet connected and on Polygon Mumbai
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback } from "react";
import { useAccount } from "wagmi";
import { useMintCard, isContractConfigured, CONTRACT_ADDRESS } from "../hooks/useMarketplace";

// ── Constants ─────────────────────────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

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
  const res = await fetch(`${BACKEND_URL}/api/ipfs/upload-asset`, {
    method: "POST",
    body:   form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data.cid; // "ipfs://..."
}

async function apiCreateMetadata({ name, description, imageCID, rarity, attributes }) {
  const res = await fetch(`${BACKEND_URL}/api/ipfs/create-metadata`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name, description, imageCID, rarity, attributes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Metadata failed (${res.status})`);
  return data.cid; // "ipfs://..."
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
  "uploading-image":"Uploading image to IPFS\u2026",
  "creating-meta":  "Creating metadata on IPFS\u2026",
  "confirm-tx":     "Waiting for wallet confirmation\u2026",
  "pending-tx":     "Transaction submitted \u2014 waiting for confirmation\u2026",
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
    <label className="block text-xs font-semibold uppercase tracking-widest text-parchment mb-1.5">
      {children}
      {required && <span className="text-crimson-light ml-0.5" aria-hidden>*</span>}
    </label>
  );
}

function InputField({ id, label, error, required, textarea, ...props }) {
  const cls = `w-full bg-charcoal border rounded-lg px-3 py-2.5 text-ivory text-sm
               placeholder:text-muted outline-none transition-colors duration-150
               focus:border-gold focus:ring-1 focus:ring-gold/30
               disabled:opacity-50 disabled:cursor-not-allowed
               ${error ? "border-crimson/60" : "border-ash"}`;
  return (
    <div>
      {label && <Label required={required}>{label}</Label>}
      {textarea
        ? <textarea id={id} className={`${cls} resize-none`} {...props} />
        : <input   id={id} className={cls} {...props} />}
      <FieldError msg={error} />
    </div>
  );
}

/** Drag-and-drop / click image picker */
function ImagePicker({ onChange, preview, error, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onChange(file);
  }, [onChange]);

  return (
    <div>
      <Label required>Card Artwork</Label>
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop or click to select card image"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed transition-colors duration-200
                    flex flex-col items-center justify-center cursor-pointer
                    overflow-hidden min-h-[180px]
                    ${dragging ? "border-gold bg-gold/10" : error ? "border-crimson/60 bg-crimson/5" : "border-ash hover:border-gold/50 bg-charcoal"}
                    ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Card preview"
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            <div className="relative z-10 bg-obsidian/70 rounded-lg px-3 py-1 text-xs text-parchment">
              Click to change
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-center pointer-events-none">
            <span className="text-3xl" aria-hidden>🖼️</span>
            <p className="text-sm text-parchment font-medium">
              Drop image here or <span className="text-gold">browse</span>
            </p>
            <p className="text-xs text-muted">PNG, JPG, GIF, SVG · max {MAX_FILE_SIZE_MB} MB</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onChange(file);
          }}
        />
      </div>
      <FieldError msg={error} />
    </div>
  );
}

/** Progress stepper shown during the multi-step mint flow */
function MintProgress({ stage, txHash, tokenId }) {
  const steps = [
    { key: "uploading-image", label: "Upload Image" },
    { key: "creating-meta",   label: "Create Metadata" },
    { key: "confirm-tx",      label: "Sign Transaction" },
    { key: "pending-tx",      label: "Confirm On-Chain" },
    { key: "success",         label: "Minted!" },
  ];

  const idx = steps.findIndex((s) => s.key === stage);

  return (
    <div className="rounded-xl border border-ash bg-charcoal p-5 flex flex-col gap-4">
      {/* Step indicators */}
      <ol className="flex items-center justify-between gap-1">
        {steps.map((step, i) => {
          const done    = i < idx || stage === "success";
          const active  = i === idx && stage !== "success";
          return (
            <li key={step.key} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
                ${done   ? "bg-gold border-gold text-obsidian"
                : active ? "border-gold text-gold animate-pulse"
                :          "border-ash text-muted"}`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] text-center leading-tight hidden sm:block
                ${done ? "text-gold" : active ? "text-parchment" : "text-muted"}`}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Status message */}
      {STAGE_LABELS[stage] && (
        <p className="text-sm text-center text-parchment flex items-center justify-center gap-2">
          {isBusy(stage) && (
            <span className="inline-block w-3 h-3 rounded-full border-2 border-gold border-t-transparent animate-spin" aria-hidden />
          )}
          {STAGE_LABELS[stage]}
        </p>
      )}

      {/* Pending tx link */}
      {txHash && stage === "pending-tx" && (
        <a
          href={`https://mumbai.polygonscan.com/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gold font-mono text-center hover:underline break-all"
        >
          {txHash.slice(0, 18)}&hellip;{txHash.slice(-8)} ↗
        </a>
      )}

      {/* Success card */}
      {stage === "success" && tokenId !== null && (
        <div className="text-center">
          <p className="text-gold font-display text-2xl font-bold">
            Token #{tokenId.toString()}
          </p>
          <p className="text-parchment text-xs mt-1">Card minted to your wallet!</p>
          {txHash && (
            <a
              href={`https://mumbai.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-muted hover:text-gold transition-colors"
            >
              View on Polygonscan ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MintCardForm({ onMintSuccess }) {
  const { isConnected } = useAccount();

  // Form state
  const [image,        setImage]        = useState(null);
  const [preview,      setPreview]      = useState(null);
  const [name,         setName]         = useState("");
  const [description,  setDescription]  = useState("");
  const [rarity,       setRarity]       = useState("Common");
  const [fieldErrors,  setFieldErrors]  = useState({});

  // IPFS intermediate values
  const [imageCID,     setImageCID]     = useState(null);
  const [metaCID,      setMetaCID]      = useState(null);

  // Multi-step stage (separate from wagmi's internal stage)
  const [mintStage,    setMintStage]    = useState("idle");
  const [stageError,   setStageError]  = useState(null);

  const { mintCard, stage: wagmiStage, txHash, tokenId, error: wagmiError, reset: resetWagmi }
    = useMintCard();

  // Merged stage: our local IPFS stages take priority, then wagmi's stage
  const effectiveStage = ["uploading-image","creating-meta"].includes(mintStage)
    ? mintStage
    : wagmiStage;

  const busy  = isBusy(effectiveStage);
  const error = stageError ?? wagmiError;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleImageChange = useCallback((file) => {
    setImage(file);
    setFieldErrors((e) => ({ ...e, image: undefined }));
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, []);

  const handleReset = useCallback(() => {
    setImage(null);
    setPreview(null);
    setName("");
    setDescription("");
    setRarity("Common");
    setFieldErrors({});
    setImageCID(null);
    setMetaCID(null);
    setMintStage("idle");
    setStageError(null);
    resetWagmi();
  }, [resetWagmi]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    const errors = validate({ image, name, description, rarity });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStageError(null);

    try {
      // ── Step 1: upload image ──────────────────────────────────────────────
      setMintStage("uploading-image");
      const cid = await apiUploadAsset(image);
      setImageCID(cid);

      // ── Step 2: create metadata ───────────────────────────────────────────
      setMintStage("creating-meta");
      const metadataURI = await apiCreateMetadata({
        name:        name.trim(),
        description: description.trim(),
        imageCID:    cid,
        rarity,
        attributes:  [], // extras can be wired up later
      });
      setMetaCID(metadataURI);

      // ── Step 3 + 4: on-chain mint (wagmi handles confirm-tx / pending-tx) ─
      setMintStage("idle"); // hand off stage tracking to wagmi hook
      await mintCard(metadataURI);

      // onMintSuccess callback (e.g. refresh card list in parent)
      onMintSuccess?.({ name, rarity, metadataURI });

    } catch (err) {
      setStageError(err.message ?? "An error occurred.");
      setMintStage("idle");
    }
  }, [image, name, description, rarity, mintCard, onMintSuccess]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div className="card-tile p-6 text-center flex flex-col items-center gap-3">
        <span className="text-4xl" aria-hidden>🔒</span>
        <p className="text-parchment font-semibold">Connect your wallet to mint cards.</p>
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
    <section className="card-tile p-6 flex flex-col gap-6 w-full max-w-lg mx-auto">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-bold text-ivory uppercase tracking-widest">
          Mint a Card
        </h2>
        <p className="text-muted text-xs mt-1">
          Upload artwork, fill in details, and mint your card as an NFT on Polygon Mumbai.
        </p>
        {/* Contract address hint */}
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

      {/* Error state */}
      {(effectiveStage === "error" || wagmiStage === "error") && error && (
        <div role="alert" className="rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3">
          <p className="text-crimson-light text-sm font-semibold">Minting failed</p>
          <p className="text-muted text-xs mt-1 break-all">{error}</p>
        </div>
      )}

      {/* Success: show Mint Another button */}
      {wagmiStage === "success" ? (
        <button onClick={handleReset} className="btn-primary w-full">
          Mint Another Card
        </button>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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
                    {r === "Legendary" ? "⭐" : r === "Epic" ? "🔴" : r === "Rare" ? "🟠" : r === "Uncommon" ? "🟤" : "⚪"}
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
            className="btn-primary w-full text-base py-3 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 rounded-full border-2 border-obsidian border-t-transparent animate-spin" aria-hidden />
                {STAGE_LABELS[effectiveStage === "idle" ? wagmiStage : effectiveStage] ?? "Processing\u2026"}
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