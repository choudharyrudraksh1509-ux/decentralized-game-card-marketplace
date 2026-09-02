const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5000';
const API_BASE = `${BACKEND_URL}/api`;

export const finalizeCopyright = async (payload) => {
  // payload: { image_hash, metadata_hash, token_id, owner_wallet }
  const res = await fetch(`${API_BASE}/registry/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to finalize copyright');
  return data;
};

export const releaseCopyright = async (tokenId) => {
  const res = await fetch(`${API_BASE}/registry/release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token_id: Number(tokenId) })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to release copyright');
  return data;
};

export const uploadAvatar = async (file) => {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BACKEND_URL}/upload-avatar`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload avatar image');
  return data.url;
};

export const updateProfile = async (token, payload) => {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update profile');
  return data;
};