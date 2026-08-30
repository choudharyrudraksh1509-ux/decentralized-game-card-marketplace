import React from "react";

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
  badgeText
}) {
  const badgeClass = RARITY_STYLES[rarity] || "badge-ash";
  
  return (
    <div className="card-tile group p-4 flex flex-col relative overflow-hidden transition-all duration-300 hover:border-gold/40 hover:-translate-y-1">
      {/* Image Section */}
      <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-obsidian mb-4">
        {image ? (
          <img 
            src={image} 
            alt={name || "Card Image"} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
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

        {/* Action Section: Price and Buy Button */}
        {(price !== undefined || onBuy) && (
          <div className="mt-auto pt-4 border-t border-ash flex items-center justify-between">
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
                    ? "bg-charcoal text-muted cursor-not-allowed border border-ash"
                    : "btn-primary shadow-lg shadow-gold/20"
                  }`}
              >
                {buyText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}