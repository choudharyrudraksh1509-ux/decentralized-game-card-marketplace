import React, { useState, useEffect } from "react";

const RARITY_STYLES = {
  Common:    "badge-ash",
  Uncommon:  "badge-ash",
  Rare:      "badge-amber",
  Epic:      "badge-crimson",
  Legendary: "badge-gold",
};

export default function Card({ 
  id, 
  image, 
  name, 
  rarity, 
  description, 
  price, 
  onBuy,
  buyDisabled = false,
  buyText = "Buy",
  badgeText,
  isListed = false,
  onList,
  listDisabled = false,
  listText = "List Card",
  onCancel,
  cancelDisabled = false,
  cancelText = "Cancel Listing",
  onBurn,
  burnDisabled = false,
  burnText = "Delete Card"
}) {
  const [listPrice, setListPrice] = useState("");
  const [imgSrc, setImgSrc] = useState(image);
  const badgeClass = RARITY_STYLES[rarity] || "badge-ash";

  useEffect(() => {
    setImgSrc(image);
  }, [image]);
  
  return (
    <div className="card-tile group p-4 flex flex-col relative overflow-hidden transition-all duration-300 hover:border-gold/40 hover:-translate-y-1 bg-charcoal text-ivory">
      {/* Image Section */}
      <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-obsidian mb-4">
        {imgSrc ? (
          <img 
            src={imgSrc} 
            alt={name || "Card Image"} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => {
              setImgSrc(`data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231a1a1a"/><stop offset="50%" stop-color="%23d4a017"/><stop offset="100%" stop-color="%230d0d0d"/></linearGradient></defs><rect width="400" height="500" rx="15" fill="url(%23g)"/><circle cx="200" cy="200" r="80" fill="%23d4a017" opacity="0.2"/><text x="200" y="220" font-family="monospace" font-size="64" fill="%23d4a017" text-anchor="middle" opacity="0.6">🎴</text><rect x="20" y="20" width="360" height="460" rx="10" fill="none" stroke="%23d4a017" stroke-width="2" opacity="0.3"/></svg>`);
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">?</div>
        )}
        
        {/* Token ID */}
        {id && (
          <div className="absolute top-2 right-2 bg-obsidian/80 backdrop-blur rounded px-2 py-1 text-[10px] font-mono text-gold border border-gold/20 shadow-lg">
            #{id.toString()}
          </div>
        )}
      </div>

      {/* Details Section */}
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-ivory truncate text-lg">
            {name || "Unknown Card"}
          </h3>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <span className={`badge ${badgeClass} text-[10px]`}>{rarity || "Unknown"}</span>
          {badgeText && (
            <span className="text-[10px] text-muted truncate">{badgeText}</span>
          )}
        </div>

        {description !== undefined && (
          <p className="text-xs text-muted line-clamp-2 mb-4 flex-1">
            {description || "No description available."}
          </p>
        )}

        {/* Action Section: Price, Buy, List, Update, Cancel */}
        {(price !== undefined || onBuy || onList) && (
          <div className="mt-auto pt-4 border-t border-ash flex flex-col gap-3">
            
            {/* Price & Buy Button Row */}
            {(price !== undefined || onBuy) && (
              <div className="flex items-center justify-between">
                {price !== undefined ? (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Price</span>
                    <span className="font-mono text-gold font-bold">
                      {price} MATIC
                    </span>
                  </div>
                ) : <div />}

                {onBuy && (
                  <button
                    onClick={onBuy}
                    disabled={buyDisabled}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all
                      ${buyDisabled 
                        ? "bg-obsidian text-muted cursor-not-allowed border border-ash"
                        : "btn-primary shadow-lg shadow-gold/20"
                      }`}
                  >
                    {buyText}
                  </button>
                )}
              </div>
            )}

            {/* List for Sale Input & Button Row (Not Listed) */}
            {(onList && !isListed) && (
              <div className="flex flex-col gap-2">
                <input 
                  type="number" min="0" step="0.01" placeholder="Price in MATIC" 
                  value={listPrice} onChange={(e) => setListPrice(e.target.value)}
                  className="w-full bg-obsidian border border-ash rounded px-3 py-2 text-sm text-ivory outline-none focus:border-gold/50"
                  disabled={listDisabled || cancelDisabled || burnDisabled}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (listPrice && parseFloat(listPrice) > 0) onList(listPrice);
                    }}
                    disabled={listDisabled || cancelDisabled || burnDisabled || !listPrice || parseFloat(listPrice) <= 0}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                      ${listDisabled || cancelDisabled || burnDisabled || !listPrice || parseFloat(listPrice) <= 0
                        ? "bg-obsidian text-muted cursor-not-allowed border border-ash"
                        : "btn-primary shadow-lg shadow-gold/20"
                      }`}
                  >
                    {listText}
                  </button>
                  {onBurn && (
                    <button
                      onClick={onBurn}
                      disabled={burnDisabled || listDisabled || cancelDisabled}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                        ${burnDisabled || listDisabled || cancelDisabled
                          ? "bg-obsidian text-muted cursor-not-allowed border border-ash"
                          : "border border-crimson text-crimson-light hover:bg-crimson/10"
                        }`}
                    >
                      {burnText}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Update Price & Cancel Listing Row (Already Listed) */}
            {(onList && isListed) && (
              <div className="flex flex-col gap-2 mt-1">
                <input 
                  type="number" min="0" step="0.01" placeholder="New Price (MATIC)" 
                  value={listPrice} onChange={(e) => setListPrice(e.target.value)}
                  className="w-full bg-obsidian border border-ash rounded px-3 py-1.5 text-sm text-ivory outline-none focus:border-gold/50"
                  disabled={listDisabled || cancelDisabled || burnDisabled}
                />
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (listPrice && parseFloat(listPrice) > 0) onList(listPrice);
                      }}
                      disabled={listDisabled || cancelDisabled || burnDisabled || !listPrice || parseFloat(listPrice) <= 0}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${listDisabled || cancelDisabled || burnDisabled || !listPrice || parseFloat(listPrice) <= 0
                          ? "bg-obsidian text-muted cursor-not-allowed border border-ash"
                          : "border border-gold text-gold hover:bg-gold/10"
                        }`}
                    >
                      {listText}
                    </button>
                    
                    {onCancel && (
                      <button
                        onClick={onCancel}
                        disabled={cancelDisabled || listDisabled || burnDisabled}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                          ${cancelDisabled || listDisabled || burnDisabled
                            ? "bg-obsidian text-muted cursor-not-allowed border border-ash"
                            : "border border-crimson text-crimson-light hover:bg-crimson/10"
                          }`}
                      >
                        {cancelText}
                      </button>
                    )}
                  </div>

                  {onBurn && (
                    <button
                      onClick={onBurn}
                      disabled={burnDisabled || listDisabled || cancelDisabled}
                      className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all
                        ${burnDisabled || listDisabled || cancelDisabled
                          ? "bg-obsidian text-muted cursor-not-allowed border border-ash"
                          : "border border-crimson/60 text-crimson-light hover:bg-crimson/20"
                        }`}
                    >
                      {burnText}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}