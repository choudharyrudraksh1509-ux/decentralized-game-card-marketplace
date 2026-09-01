import { useState } from "react";
import WalletConnector from "./components/WalletConnector";
import MintCardForm    from "./components/MintCardForm";
import MarketplaceGallery from "./components/MarketplaceGallery";
import MyCollection       from "./components/MyCollection";
import TransactionHistory from "./components/TransactionHistory";

import { useAuth } from "./context/AuthContext";
import LoginPage from "./components/LoginPage";
import ProfileSettingsModal from "./components/ProfileSettingsModal";

// ── Navbar ────────────────────────────────────────────────
function Navbar({ onOpenSettings }) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-[#0F172A]/90 backdrop-blur border-b border-gold/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" aria-hidden="true">&#x1F0CF;</span>
          <span className="font-display text-2xl font-black text-gold tracking-widest uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
            Card Nexus
          </span>
        </div>
        
        <nav className="hidden lg:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-parchment">
          <a href="#marketplace" className="hover:text-gold hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-all">Marketplace</a>
          <a href="#my-cards"    className="hover:text-gold hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-all">My Cards</a>
          <a href="#history"     className="hover:text-gold hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-all">History</a>
        </nav>
        
        <div className="flex items-center gap-4">
          {/* User Profile & Wallet Badge */}
          {user && (
            <div className="flex items-center gap-3 bg-obsidian border border-gold/40 rounded-full py-1.5 px-4 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full border border-gold/50 object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-graphite border border-gold/50 flex items-center justify-center text-xs font-bold text-gold">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'P'}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-bold text-ivory leading-tight">{user.username}</span>
                <span className="text-[10px] text-muted font-mono leading-none">
                  {user.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-1 ml-2 border-l border-ash/40 pl-2">
                <button onClick={onOpenSettings} title="Settings & Wallet" className="p-1 text-muted hover:text-gold transition-colors text-sm">
                  ⚙️
                </button>
                <button onClick={logout} title="Logout" className="p-1 text-muted hover:text-crimson-light transition-colors text-sm">
                  🚪
                </button>
              </div>
            </div>
          )}
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
        <a href="#mint"        className="btn-ghost text-base">Mint a Card</a>
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  // Loading state while checking token
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-gold font-bold font-display uppercase tracking-widest gap-4">
        <span className="text-5xl animate-bounce">🃏</span>
        <span>Initializing Card Nexus...</span>
      </div>
    );
  }

  // GATEKEEPER: If user is NOT logged in, show the Dedicated Fullscreen Gaming Login Portal!
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Once authenticated, show full Dashboard!
  return (
    <div className="min-h-screen flex flex-col bg-[#0F172A]">
      <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
      
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
              Upload your artwork and create a new on-chain game card protected by copyright hashing.
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

      <ProfileSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}