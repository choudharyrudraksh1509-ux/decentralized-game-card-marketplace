import WalletConnector from "./components/WalletConnector";
import MintCardForm    from "./components/MintCardForm";
import MarketplaceGallery from "./components/MarketplaceGallery";
import MyCollection       from "./components/MyCollection";
import TransactionHistory from "./components/TransactionHistory";

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
          <a href="#history"     className="hover:text-gold transition-colors">History</a>
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
        
        <div className="divider-gold max-w-7xl mx-auto px-8" />
        <TransactionHistory />

      </main>
      <Footer />
    </div>
  );
}