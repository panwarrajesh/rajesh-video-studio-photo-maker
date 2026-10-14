import { create } from 'zustand';
import { api, hasSession, setTokens, clearTokens } from '../services/api.js';

export const useAuth = create((set) => ({
  user: null, loading: true,
  async init() { // restore the saved session; in cookie mode api() silently refreshes with the HttpOnly cookie
    if (!hasSession()) return set({ loading: false });
    try { set({ user: (await api('/auth/me')).user, loading: false }); } catch { set({ user: null, loading: false }); }
  },
  async submit(mode, form) { const d = await api(`/auth/${mode}`, { method: 'POST', body: form }); setTokens(d); set({ user: d.user }); },
  logout() { // explicit logout: revoke the refresh token on the server, then clear this device
    const refreshToken = localStorage.getItem('rvs_refresh');
    api('/auth/logout', { method: 'POST', body: refreshToken ? { refreshToken } : {} }).catch(() => {});
    clearTokens(); set({ user: null });
  },
}));
