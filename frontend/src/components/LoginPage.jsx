import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccount } from 'wagmi';
import WalletConnector from './WalletConnector';

export default function LoginPage() {
  const [tab, setTab] = useState('login'); // login, register, forgot, reset
  const { login, register, forgotPassword, resetPassword } = useAuth();
  const { address, isConnected } = useAccount();

  const [form, setForm] = useState({
    identifier: '',
    password: '',
    username: '',
    email: '',
    full_name: '',
    otp: '',
    new_password: ''
  });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [emailPreviewUrl, setEmailPreviewUrl] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const clearMessages = () => {
    setError('');
    setMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setIsSubmitting(true);

    try {
      if (tab === 'login') {
        await login(form.identifier, form.password);
      } else if (tab === 'register') {
        if (!isConnected) throw new Error("Please connect your MetaMask wallet first to bind your account.");
        await register({ ...form, wallet_address: address });
      } else if (tab === 'forgot') {
        const data = await forgotPassword(form.email);
        setMsg(data.message);
        if (data.preview_url) {
          setEmailPreviewUrl(data.preview_url);
        }
        setTab('reset');
      } else if (tab === 'reset') {
        const result = await resetPassword(form.email, form.otp, form.new_password);
        setMsg(result);
        setTab('login');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col justify-between relative overflow-hidden text-ivory select-none">
      {/* Ambient background glows & card graphics */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gold/10 blur-[150px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 w-[500px] h-[400px] bg-crimson/10 blur-[130px] rounded-full" />
      <div className="pointer-events-none absolute top-1/3 -right-20 w-[450px] h-[450px] bg-gold/5 blur-[140px] rounded-full" />

      {/* Top Bar */}
      <header className="relative z-10 max-w-7xl mx-auto w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-4xl drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]">🃏</span>
          <span className="font-display text-2xl font-black text-gold tracking-widest uppercase drop-shadow-md">
            Card Nexus
          </span>
        </div>
        <div>
          <WalletConnector />
        </div>
      </header>

      {/* Main Content: Split Screen Gaming Portal */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Column: Hero & Lore */}
        <div className="lg:col-span-7 space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-mono font-bold uppercase tracking-widest">
            <span>⚔️ Web3 Gaming Marketplace</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-black uppercase tracking-wider leading-none text-ivory drop-shadow-lg">
            Enter The Arena.<br />
            <span className="text-gold drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
              Trade & Protect Your Legacy.
            </span>
          </h1>

          <p className="text-parchment text-base sm:text-lg leading-relaxed max-w-xl">
            Welcome to Card Nexus. Connect your wallet, authenticate your player identity, and mint exclusive digital cards protected by on-chain copyright hashing protocols.
          </p>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="bg-obsidian/80 border border-ash/60 rounded-xl p-4 shadow-card">
              <div className="text-2xl mb-1">🛡️</div>
              <h3 className="text-xs font-bold uppercase text-gold">Copyright Hashing</h3>
              <p className="text-[11px] text-muted mt-1">Anti-duplication algorithm protects card uniqueness.</p>
            </div>
            <div className="bg-obsidian/80 border border-ash/60 rounded-xl p-4 shadow-card">
              <div className="text-2xl mb-1">⚡</div>
              <h3 className="text-xs font-bold uppercase text-gold">Zero-Refresh UX</h3>
              <p className="text-[11px] text-muted mt-1">Real-time cache invalidation updates without reloads.</p>
            </div>
            <div className="bg-obsidian/80 border border-ash/60 rounded-xl p-4 shadow-card">
              <div className="text-2xl mb-1">🔥</div>
              <h3 className="text-xs font-bold uppercase text-gold">On-Chain Burn</h3>
              <p className="text-[11px] text-muted mt-1">Permanently destroy cards on-chain anytime.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Gamified Authentication Card */}
        <div className="lg:col-span-5 w-full">
          <div className="bg-obsidian border border-gold/40 rounded-2xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-md relative overflow-hidden">
            
            {/* Header Tabs */}
            <div className="flex border-b border-ash/50 mb-6 bg-[#0F172A]/80 rounded-lg p-1">
              {tab === 'login' || tab === 'register' ? (
                <>
                  <button
                    onClick={() => { setTab('login'); clearMessages(); }}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                      tab === 'login'
                        ? 'bg-gold text-obsidian shadow-[0_0_15px_rgba(245,158,11,0.5)] font-black'
                        : 'text-muted hover:text-ivory'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => { setTab('register'); clearMessages(); }}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
                      tab === 'register'
                        ? 'bg-gold text-obsidian shadow-[0_0_15px_rgba(245,158,11,0.5)] font-black'
                        : 'text-muted hover:text-ivory'
                    }`}
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <div className="flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider text-gold">
                  {tab === 'forgot' ? 'Reset Password' : 'Verify OTP Code'}
                </div>
              )}
            </div>

            {/* Notifications */}
            {error && (
              <div className="mb-4 p-3 bg-crimson/20 border border-crimson text-crimson-light rounded-lg text-xs leading-relaxed">
                ⚠️ {error}
              </div>
            )}
            {msg && (
              <div className="mb-4 p-3 bg-gold/10 border border-gold/50 text-gold rounded-lg text-xs leading-relaxed">
                ℹ️ {msg}
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              {/* LOGIN TAB */}
              {tab === 'login' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">
                      Username or Email
                    </label>
                    <input
                      name="identifier"
                      placeholder="e.g. GamerOne or gamer@nexus.com"
                      value={form.identifier}
                      onChange={handleChange}
                      className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 text-sm text-ivory focus:border-gold outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        name="password"
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={handleChange}
                        className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 pr-10 text-sm text-ivory focus:border-gold outline-none transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors text-sm"
                        title={showPass ? "Hide password" : "Show password"}
                      >
                        {showPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { setTab('forgot'); clearMessages(); }}
                      className="text-xs text-gold/80 hover:text-gold hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </>
              )}

              {/* SIGN UP TAB */}
              {tab === 'register' && (
                <>
                  {/* Wallet Binding Status Badge */}
                  <div className="p-3 bg-[#0F172A] border border-ash rounded-lg flex items-center justify-between text-xs">
                    <span className="text-muted font-bold uppercase tracking-wider">MetaMask Wallet:</span>
                    {isConnected ? (
                      <span className="font-mono text-gold bg-gold/10 border border-gold/30 px-2 py-1 rounded font-bold">
                        {address.slice(0, 6)}...{address.slice(-4)}
                      </span>
                    ) : (
                      <span className="text-crimson-light font-bold">Not Connected</span>
                    )}
                  </div>

                  {!isConnected && (
                    <p className="text-[11px] text-crimson-light bg-crimson/10 p-2 rounded border border-crimson/30">
                      💡 Click "Connect Wallet" in the top bar before signing up to link your account.
                    </p>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Full Name</label>
                    <input
                      name="full_name"
                      placeholder="e.g. Alex Mercer"
                      value={form.full_name}
                      onChange={handleChange}
                      className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 text-sm text-ivory focus:border-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Username</label>
                    <input
                      name="username"
                      placeholder="e.g. ShadowKnight"
                      value={form.username}
                      onChange={handleChange}
                      className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 text-sm text-ivory focus:border-gold outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Email Address</label>
                    <input
                      name="email"
                      type="email"
                      placeholder="player@example.com"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 text-sm text-ivory focus:border-gold outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Password</label>
                    <div className="relative">
                      <input
                        name="password"
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        value={form.password}
                        onChange={handleChange}
                        className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 pr-10 text-sm text-ivory focus:border-gold outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors text-sm"
                        title={showPass ? "Hide password" : "Show password"}
                      >
                        {showPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* FORGOT PASSWORD TAB */}
              {tab === 'forgot' && (
                <>
                  <p className="text-xs text-muted">
                    Enter your registered email address below. A 6-digit recovery code will be generated for your account.
                  </p>
                  <input
                    name="email"
                    type="email"
                    placeholder="player@example.com"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 text-sm text-ivory focus:border-gold outline-none"
                    required
                  />
                </>
              )}

              {/* RESET PASSWORD TAB */}
              {tab === 'reset' && (
                <>
                  <p className="text-xs text-muted">
                    Enter the 6-digit OTP code sent to <span className="text-gold font-bold">{form.email}</span>.
                  </p>
                  {emailPreviewUrl && (
                    <a
                      href={emailPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-gold/10 border border-gold/40 text-gold rounded-lg text-xs font-bold text-center hover:bg-gold/20 transition-colors shadow-sm"
                    >
                      📧 Open Sent Email Inbox Preview (Click to View Code)
                    </a>
                  )}
                  <input
                    name="otp"
                    placeholder="123456"
                    value={form.otp}
                    onChange={handleChange}
                    className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 text-sm text-ivory focus:border-gold outline-none font-mono tracking-widest text-center"
                    required
                  />
                  <input
                    name="new_password"
                    type="password"
                    placeholder="New Password"
                    value={form.new_password}
                    onChange={handleChange}
                    className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 text-sm text-ivory focus:border-gold outline-none"
                    required
                  />
                </>
              )}

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isSubmitting || (tab === 'register' && !isConnected)}
                className="btn-primary w-full py-3.5 mt-2 font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? 'Verifying...'
                  : tab === 'login'
                  ? 'Enter Nexus ➔'
                  : tab === 'register'
                  ? 'Forge Identity ⚔️'
                  : tab === 'forgot'
                  ? 'Send Code 📩'
                  : 'Reset Password 🔑'}
              </button>
            </form>

            {(tab === 'forgot' || tab === 'reset') && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setTab('login'); clearMessages(); }}
                  className="text-xs text-muted hover:text-ivory"
                >
                  ← Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-7xl mx-auto w-full px-6 py-4 text-center text-muted text-xs font-mono border-t border-ash/30">
        Card Nexus · Web3 Gaming Portal · Protected by Copyright Hashing Protocol
      </footer>
    </div>
  );
}
