import WalletConnector from "./components/WalletConnector";
import MintCardForm    from "./components/MintCardForm";
import MarketplaceGallery from "./components/MarketplaceGallery";
import MyCollection       from "./components/MyCollection";

// ── Static demo card data ─────────────────────────────────
const DEMO_CARDS = [
  { id: 1, name: "Inferno Drake",  rarity: "Legendary", price: "0.42 ETH", edition: "#012 / 100",  tag: "FIRE",   tagClass: "badge-crimson" },
  { id: 2, name: "Iron Sentinel",  rarity: "Rare",       price: "0.08 ETH", edition: "#204 / 500",  tag: "METAL",  tagClass: "badge-amber"   },
  { id: 3, name: "Ashen Phantom",  rarity: "Epic",       price: "0.19 ETH", edition: "#051 / 250",  tag: "SHADOW", tagClass: "badge-gold"    },
  { id: 4, name: "Ember Witch",    rarity: "Uncommon",   price: "0.03 ETH", edition: "#781 / 2000", tag: "FIRE",   tagClass: "badge-crimson" },
];

const rarityOrder = { Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5 };
const rarityColor = {
  Legendary: "text-gold-light",
  Epic:      "text-crimson-light",
  Rare:      "text-amber-light",
  Uncommon:  "text-parchment",
  Common:    "text-muted",
};

// ── Navbar ────────────────────────────────────────────────
function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-charcoal/80 backdrop-blur border-b border-ash">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">&#x1F0CF;</span>
          <span className="font-display text-xl font-bold text-gold tracking-widest uppercase">
            Card Nexus
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold uppercase tracking-widest text-parchment">
          <a href="#marketplace" className="hover:text-gold transition-colors">Marketplace</a>
          <a href="#my-cards"    className="hover:text-gold transition-colors">My Cards</a>
          <a href="#activity"    className="hover:text-gold transition-colors">Activity</a>
        </nav>
        <div className="flex items-center justify-end min-w-[200px]">
          <WalletConnector />
        </div>
      </div>
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative py-24 px-4 text-center overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gold/10 blur-[120px] rounded-full" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[300px] bg-crimson/10 blur-[100px] rounded-full" />

      <h1 className="font-display text-5xl md:text-7xl font-black text-ivory uppercase tracking-widest drop-shadow-lg">
        Trade Cards.<br />
        <span className="text-gold">Own the Game.</span>
      </h1>

      <p className="mt-6 text-parchment max-w-2xl mx-auto text-lg leading-relaxed">
        A fully on-chain marketplace to buy, sell, and auction rare digital
        collectible cards. No middlemen. No gas surprises. Just you and the blockchain.
      </p>

      <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
        <a href="#marketplace" className="btn-primary text-base">Browse Cards</a>
        <a href="#my-cards"    className="btn-ghost text-base">List a Card</a>
      </div>

      <div className="mt-16 inline-grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-ash shadow-card">
        {[
          { label: "Cards Listed",   value: "14,230" },
          { label: "Total Volume",   value: "892 ETH" },
          { label: "Unique Traders", value: "3,412"  },
        ].map((s) => (
          <div key={s.label} className="bg-graphite px-8 py-4 text-center">
            <p className="text-2xl font-bold text-gold font-mono">{s.value}</p>
            <p className="text-xs text-muted uppercase tracking-widest mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Card Tile ─────────────────────────────────────────────
function CardTile({ card }) {
  return (
    <article className="card-tile p-4 flex flex-col gap-3">
      <div className="relative rounded-lg overflow-hidden bg-ash aspect-[3/4] flex items-center justify-center">
        <span className="text-6xl select-none" aria-hidden="true">&#x1F0CF;</span>
        <div className="absolute top-2 right-2">
          <span className={card.tagClass}>{card.tag}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-1">
        <h3 className="font-display font-semibold text-ivory truncate">{card.name}</h3>
        <p className={`text-xs font-mono font-bold uppercase tracking-widest ${rarityColor[card.rarity]}`}>
          {card.rarity}
        </p>
        <p className="text-xs text-muted">{card.edition}</p>
      </div>

      <div className="divider-gold my-0" />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-widest">Price</p>
          <p className="text-gold font-mono font-bold text-sm">{card.price}</p>
        </div>
        <button className="btn-primary text-xs px-4 py-2">Buy Now</button>
      </div>
    </article>
  );
}

// ── Marketplace ───────────────────────────────────────────
function Marketplace() {
  const sorted = [...DEMO_CARDS].sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
  return (
    <section id="marketplace" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-display text-3xl font-bold text-ivory uppercase tracking-widest">Marketplace</h2>
          <p className="text-muted text-sm mt-1">Sorted by rarity · Live on-chain</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost text-xs px-3 py-1.5">All</button>
          <button className="btn-ghost text-xs px-3 py-1.5">Fire</button>
          <button className="btn-ghost text-xs px-3 py-1.5">Metal</button>
          <button className="btn-ghost text-xs px-3 py-1.5">Shadow</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {sorted.map((card) => <CardTile key={card.id} card={card} />)}
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-ash mt-24 py-10 text-center text-muted text-xs font-mono">
      <p>Card Nexus · Decentralised Game Card Marketplace · <span className="text-gold">Powered by Ethereum</span></p>
      <p className="mt-2 opacity-50">
        {new Date().getFullYear()} — All rights reserved. Smart contracts are unaudited. Use at your own risk.
      </p>
    </footer>
  );
}

// ── Root App ──────────────────────────────────────────────
export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <div className="divider-gold max-w-7xl mx-auto px-8" />
        {/* Mint section */}
        <section id="mint" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-ivory uppercase tracking-widest">
              Mint a Card
            </h2>
            <p className="text-muted text-sm mt-1">
              Upload your artwork and create a new on-chain game card.
            </p>
          </div>
          <MintCardForm />
        </section>
        <div className="divider-gold max-w-7xl mx-auto px-8" />
        <MarketplaceGallery />
        <div className="divider-gold max-w-7xl mx-auto px-8" />
        <MyCollection />
      </main>
      <Footer />
    </div>
  );
}