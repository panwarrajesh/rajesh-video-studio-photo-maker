import { create } from 'zustand';
import { api } from '../services/api.js';

export const useAuth = create((set) => ({
  user: null, loading: true,
  async init() {
    if (!localStorage.getItem('rvs_access')) return set({ loading: false });
    try { set({ user: (await api('/auth/me')).user, loading: false }); } catch { set({ user: null, loading: false }); }
  },
  async submit(mode, form) {
    const d = await api(`/auth/${mode}`, { method: 'POST', body: form });
    localStorage.setItem('rvs_access', d.accessToken); localStorage.setItem('rvs_refresh', d.refreshToken);
    set({ user: d.user });
  },
  logout() { api('/auth/logout', { method: 'POST' }).catch(() => {}); localStorage.clear(); set({ user: null }); },
}));
