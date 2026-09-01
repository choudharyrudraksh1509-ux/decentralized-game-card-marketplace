import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccount, useDisconnect } from 'wagmi';
import { uploadAvatar } from '../api/auth';

export default function ProfileSettingsModal({ isOpen, onClose }) {
  const { user, updateProfile } = useAuth();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedWallet, setCopiedWallet] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setAvatarUrl(user.avatar_url || '');
      setAvatarPreview(user.avatar_url || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setMsg('');
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('File must be an image.');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      setError('');
      const uploadedUrl = await uploadAvatar(file);
      setAvatarUrl(uploadedUrl);
      setAvatarPreview(URL.createObjectURL(file));
      setMsg('Avatar uploaded! Click "Save Settings" to confirm.');
    } catch (err) {
      setError(err.message || 'Avatar upload failed.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCopyWallet = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');

    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError('Please enter your current password to set a new password.');
        return;
      }
      if (!newPassword) {
        setError('Please enter your new password.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('New password and Confirm password do not match.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {};
      if (fullName !== (user.full_name || '')) payload.full_name = fullName;
      if (avatarUrl !== (user.avatar_url || '')) payload.avatar_url = avatarUrl;
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      if (Object.keys(payload).length > 0) {
        await updateProfile(payload);
        setMsg('Settings updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMsg('No changes made.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm p-4">
      <div className="bg-obsidian border border-gold/40 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full max-w-lg overflow-hidden relative max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-ash/50 bg-[#0F172A]">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h2 className="text-gold font-display font-bold uppercase tracking-wider text-lg">Account Settings</h2>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ivory text-2xl font-bold">&times;</button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && <div className="p-3 bg-crimson/20 border border-crimson text-crimson-light rounded-lg text-xs leading-relaxed">⚠️ {error}</div>}
          {msg && <div className="p-3 bg-gold/10 border border-gold/50 text-gold rounded-lg text-xs leading-relaxed">ℹ️ {msg}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Profile Avatar Upload Section */}
            <div className="flex items-center gap-5 p-4 bg-[#0F172A] border border-ash/50 rounded-xl">
              <div className="relative group w-16 h-16 rounded-full overflow-hidden border-2 border-gold/50 flex-shrink-0 bg-graphite flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-gold">
                    {user.username ? user.username.charAt(0).toUpperCase() : 'P'}
                  </span>
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-obsidian/80 flex items-center justify-center text-gold text-xs font-bold animate-pulse">
                    Uploading...
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-ivory tracking-wider mb-1">Profile Avatar</h4>
                <p className="text-[11px] text-muted mb-2">Upload a custom profile photo (JPEG, PNG, WEBP).</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="btn-ghost py-1.5 px-3 text-xs font-bold border-gold/40 text-gold hover:bg-gold/10"
                >
                  {isUploadingAvatar ? 'Uploading...' : '📷 Change Photo'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleAvatarFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* General Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-gold tracking-widest border-b border-ash/30 pb-2">
                Personal Identity
              </h3>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">
                  Username (Fixed)
                </label>
                <input
                  type="text"
                  value={user.username}
                  disabled
                  className="w-full bg-[#0F172A]/50 border border-ash/40 rounded-lg p-3 text-sm text-muted outline-none cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">
                  Display Name
                </label>
                <input
                  name="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Alex Mercer"
                  className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 text-sm text-ivory focus:border-gold outline-none"
                />
              </div>
            </div>

            {/* Password Update Section with Eye Toggle */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase text-gold tracking-widest border-b border-ash/30 pb-2">
                Security & Password
              </h3>

              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 pr-10 text-sm text-ivory focus:border-gold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors text-sm"
                    title={showCurrentPass ? "Hide password" : "Show password"}
                  >
                    {showCurrentPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 pr-10 text-sm text-ivory focus:border-gold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors text-sm"
                      title={showNewPass ? "Hide password" : "Show password"}
                    >
                      {showNewPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full bg-[#0F172A] border border-ash rounded-lg p-3 pr-10 text-sm text-ivory focus:border-gold outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gold transition-colors text-sm"
                      title={showConfirmPass ? "Hide password" : "Show password"}
                    >
                      {showConfirmPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Wallet Management Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase text-gold tracking-widest border-b border-ash/30 pb-2">
                Connected Wallet Details
              </h3>

              <div className="p-4 bg-[#0F172A] border border-ash rounded-xl flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-widest font-bold">Bound Wallet Address</p>
                  <p className="font-mono text-sm text-ivory font-bold mt-0.5">
                    {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : 'No wallet connected'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWallet}
                    disabled={!address}
                    className="px-3 py-1.5 text-xs font-bold bg-graphite border border-ash hover:border-gold text-parchment hover:text-gold rounded-lg transition-colors"
                  >
                    {copiedWallet ? '✅ Copied!' : '📋 Copy Address'}
                  </button>

                  {isConnected && (
                    <button
                      type="button"
                      onClick={() => disconnect()}
                      className="px-3 py-1.5 text-xs font-bold bg-crimson/20 border border-crimson/50 hover:bg-crimson/40 text-crimson-light rounded-lg transition-colors"
                    >
                      🔌 Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={isSubmitting || isUploadingAvatar}
              className="btn-primary w-full py-3.5 mt-4 font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}