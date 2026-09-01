import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccount } from 'wagmi';

export default function AuthModal({ isOpen, onClose }) {
  const [tab, setTab] = useState('login'); // login, register, forgot, reset
  const { login, register, forgotPassword, resetPassword } = useAuth();
  const { address, isConnected } = useAccount();

  const [form, setForm] = useState({ identifier: '', password: '', username: '', email: '', full_name: '', otp: '', new_password: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const clearMessages = () => { setError(''); setMsg(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setIsSubmitting(true);
    
    try {
      if (tab === 'login') {
        await login(form.identifier, form.password);
        onClose();
      } else if (tab === 'register') {
        if (!isConnected) throw new Error("Please connect your MetaMask wallet first.");
        await register({ ...form, wallet_address: address });
        onClose();
      } else if (tab === 'forgot') {
        const result = await forgotPassword(form.email);
        setMsg(result);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm p-4">
      <div className="bg-obsidian border border-gold/40 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] w-full max-w-md overflow-hidden flex flex-col relative">
        
        {/* Header Tabs */}
        <div className="flex border-b border-ash/50 bg-[#0F172A]">
          {(tab === 'login' || tab === 'register') ? (
            <>
              <button onClick={() => { setTab('login'); clearMessages(); }} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${tab === 'login' ? 'text-gold border-b-2 border-gold' : 'text-muted hover:text-ivory'}`}>Login</button>
              <button onClick={() => { setTab('register'); clearMessages(); }} className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${tab === 'register' ? 'text-gold border-b-2 border-gold' : 'text-muted hover:text-ivory'}`}>Sign Up</button>
            </>
          ) : (
            <div className="flex-1 py-4 text-center text-sm font-bold uppercase tracking-wider text-gold border-b-2 border-gold">
              {tab === 'forgot' ? 'Reset Password' : 'Enter OTP'}
            </div>
          )}
          <button onClick={onClose} className="absolute top-3 right-4 text-muted hover:text-ivory text-xl">&times;</button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-crimson/20 border border-crimson text-crimson-light rounded text-sm">{error}</div>}
          {msg && <div className="mb-4 p-3 bg-gold/10 border border-gold/50 text-gold rounded text-sm">{msg}</div>}
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {tab === 'login' && (
              <>
                <input name="identifier" placeholder="Username or Email" value={form.identifier} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none" required />
                <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none" required />
                <div className="text-right">
                  <button type="button" onClick={() => { setTab('forgot'); clearMessages(); }} className="text-xs text-gold/80 hover:text-gold hover:underline">Forgot Password?</button>
                </div>
              </>
            )}

            {tab === 'register' && (
              <>
                <div className="p-3 bg-graphite border border-ash rounded flex items-center justify-between text-sm">
                  <span className="text-muted">Bound Wallet:</span>
                  {isConnected ? (
                    <span className="font-mono text-gold bg-gold/10 px-2 py-1 rounded">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  ) : (
                    <span className="text-crimson-light font-bold">Not Connected</span>
                  )}
                </div>
                <input name="full_name" placeholder="Full Name (Optional)" value={form.full_name} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none" />
                <input name="username" placeholder="Username" value={form.username} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none" required />
                <input name="email" type="email" placeholder="Email Address" value={form.email} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none" required />
                <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none" required />
              </>
            )}

            {tab === 'forgot' && (
              <>
                <p className="text-xs text-muted mb-2">Enter your email address to receive a 6-digit recovery code.</p>
                <input name="email" type="email" placeholder="Email Address" value={form.email} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none" required />
              </>
            )}

            {tab === 'reset' && (
              <>
                <p className="text-xs text-muted mb-2">Check your terminal (simulated email) for the OTP sent to {form.email}.</p>
                <input name="otp" placeholder="6-Digit OTP" value={form.otp} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none font-mono tracking-widest text-center" required />
                <input name="new_password" type="password" placeholder="New Password" value={form.new_password} onChange={handleChange} className="bg-[#0F172A] border border-ash rounded p-3 text-ivory focus:border-gold outline-none" required />
              </>
            )}

            <button type="submit" disabled={isSubmitting || (tab === 'register' && !isConnected)} className="btn-primary py-3 mt-2 font-bold shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:opacity-50 disabled:cursor-not-allowed">
              {isSubmitting ? 'Processing...' : (tab === 'login' ? 'Enter Nexus' : tab === 'register' ? 'Forge Identity' : tab === 'forgot' ? 'Send Code' : 'Reset Password')}
            </button>
          </form>

          {(tab === 'forgot' || tab === 'reset') && (
            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setTab('login'); clearMessages(); }} className="text-xs text-muted hover:text-ivory">&larr; Back to Login</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}